import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { replacePlaceholders } from '@/lib/templates';
import { HTML_EMAIL_BASE } from '@/lib/landing-template-defaults';
import { decryptSecret } from '@/lib/crypto';

/**
 * Reemplazo de enviarPendientes (Script B del sistema viejo). Recorre
 * email_sends con status='pending' y scheduled_for <= ahora, arma el
 * email a partir de la plantilla + contenido del paso, y lo manda vía
 * la API de Brevo. Se llama desde:
 *   - netlify/functions/send-pending-emails.ts (cron cada 1 hora)
 *   - el botón "Enviar pendientes ahora" en /admin/landings (para probar
 *     sin esperar al cron ni depender de un deploy)
 *
 * NOTA sobre rotación multi-cuenta de Brevo: hoy usa una sola cuenta
 * (BREVO_API_KEY_1, la fila `brevo_accounts` de prioridad más alta y
 * activa). El modelo de datos ya soporta más de una fila — cuando haga
 * falta, esta función es el único lugar que cambia: elegir cuenta según
 * `emails_sent_today < daily_limit`, en vez de tomar siempre la primera.
 */
// Bug real confirmado (2026-08-24, Ronda 3) — cuánto puede durar como
// máximo un envío real reclamado (pending → processing) antes de
// considerarlo huérfano. enviarPorBrevo tarda como mucho 3 intentos x
// 15s de timeout + el backoff entre medio (500ms + 1s), bastante menos
// de 1 minuto en el peor caso — 15 minutos deja margen de sobra sin
// arriesgarse a "recuperar" un envío que en realidad sigue en curso.
const MINUTOS_PROCESSING_HUERFANO = 15;

export async function processPendingEmails() {
  const supabase = createSupabaseServiceClient();
  const resultado = { procesados: 0, enviados: 0, errores: 0, omitidos: 0 };

  // Bug real confirmado (2026-08-24, Ronda 3) — recuperación de filas
  // huérfanas: si un proceso anterior murió justo después de reclamar
  // una fila (pending → processing) y antes de terminarla, esa fila
  // quedaba en 'processing' para siempre porque nada volvía a
  // consultarla (ver 0011_email_sends_claimed_at.sql). Antes de buscar
  // pendientes, resetea a 'pending' las que quedaron reclamadas hace más
  // de MINUTOS_PROCESSING_HUERFANO minutos (o sin claimed_at, filas
  // reclamadas antes de que existiera esta columna) para que este mismo
  // ciclo ya las vuelva a intentar.
  const limiteRecuperacion = new Date(Date.now() - MINUTOS_PROCESSING_HUERFANO * 60_000).toISOString();
  const { data: recuperados } = await supabase
    .from('email_sends')
    .update({ status: 'pending', claimed_at: null })
    .eq('status', 'processing')
    .or(`claimed_at.is.null,claimed_at.lt.${limiteRecuperacion}`)
    .select('id');

  if (recuperados && recuperados.length > 0) {
    console.warn(`processPendingEmails: se recuperaron ${recuperados.length} fila(s) de email_sends huérfanas en 'processing'.`);
  }

  const { data: pendientes, error } = await supabase
    .from('email_sends')
    .select(
      `id, lead_id, landing_email_step_id,
       leads(email, first_name, last_name, campaign_id, campaigns(advisor_name, whatsapp_number, status, landing_id, landings(is_active))),
       landing_email_steps(subject, content, email_template_id, step_number, email_templates(html_content))`
    )
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString());

  if (error) {
    console.error('Error leyendo email_sends pendientes:', error);
    return resultado;
  }

  const { data: cuenta } = await supabase
    .from('brevo_accounts')
    .select('env_var_name, api_key_encrypted, sender_email, sender_name, id')
    .eq('is_active', true)
    .order('priority', { ascending: true })
    .limit(1)
    .single();

  if (!cuenta) {
    console.error('No hay ninguna cuenta de Brevo activa configurada.');
    return resultado;
  }

  // Panel de Integraciones (2026-08-24, ver app/admin/(dashboard)/settings/
  // integrations) — si un admin conectó/actualizó la key desde ahí, esa
  // clave cifrada en la base tiene prioridad sobre la variable de entorno
  // de siempre. Si nunca se usó el panel, api_key_encrypted queda null y
  // sigue funcionando exactamente igual que antes, vía env_var_name.
  let apiKey: string | undefined;
  if (cuenta.api_key_encrypted) {
    try {
      apiKey = decryptSecret(cuenta.api_key_encrypted);
    } catch (err) {
      console.error('Error desencriptando la API key de Brevo guardada en la base:', err);
      // Bug real confirmado (2026-08-24) — si SECRETS_ENCRYPTION_KEY rota o
      // se pierde (o se restaura un backup de base cifrado bajo la key
      // vieja) sin volver a conectar Brevo desde el panel, decryptSecret()
      // tira acá y ANTES el envío se cortaba en seco aunque la cuenta
      // tuviera env_var_name configurado — la variable de entorno "de
      // siempre" seguía andando perfecto, pero nunca se llegaba a probar.
      // Mismo criterio de resiliencia que ya usa el resto del archivo (ver
      // el comentario del panel de Integraciones más arriba): si hay una
      // env var de respaldo, usarla antes de rendirse.
      if (cuenta.env_var_name) {
        apiKey = process.env[cuenta.env_var_name];
        if (!apiKey) {
          console.error(`Tampoco hay variable de entorno ${cuenta.env_var_name} para usar como respaldo.`);
        }
      }
    }
  } else if (cuenta.env_var_name) {
    apiKey = process.env[cuenta.env_var_name];
    if (!apiKey) console.error(`Falta la variable de entorno ${cuenta.env_var_name} con la API key de Brevo.`);
  }

  if (!apiKey) {
    const mensaje =
      'No hay ninguna API key de Brevo utilizable (ni conectada desde el panel, ni por variable de entorno) — no se mandó ningún email de ninguna campaña en este ciclo.';
    console.error(mensaje);
    // Bug real confirmado (2026-08-24) — hasta acá el único rastro de esta
    // falla era el console.error de arriba, que se pierde en los logs de la
    // función de Netlify: nadie se entera hasta que un lead reclama no
    // haber recibido el mail. system_alerts (ver
    // supabase/migrations/0017_system_alerts.sql, todavía sin aplicar) deja
    // una fila consultable por un admin sin tener que ir a buscar logs.
    await registrarAlerta(supabase, 'email_brevo_api_key', mensaje);
    return resultado;
  }

  const webappUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';

  for (const envio of pendientes ?? []) {
    resultado.procesados++;

    const lead = envio.leads as unknown as {
      email: string;
      first_name: string | null;
      last_name: string | null;
      campaign_id: string;
      campaigns: {
        advisor_name: string | null;
        whatsapp_number: string | null;
        status: string;
        landing_id: string;
        landings: { is_active: boolean } | null;
      } | null;
    } | null;
    const paso = envio.landing_email_steps as unknown as {
      subject: string;
      content: string;
      step_number: number;
      email_templates: { html_content: string } | null;
    } | null;

    if (!lead || !paso) {
      await marcarError(supabase, envio.id, 'Faltan datos de lead o de paso de campaña.');
      resultado.errores++;
      continue;
    }

    // Bug real confirmado (2026-08-24, Ronda 2) — antes se mandaba
    // cualquier email_sends pendiente vencido sin fijarse si la campaña
    // que lo originó seguía activa o si su landing seguía prendida: un
    // lead capturado con una campaña que después se pausó/archivó (o su
    // landing se desactivó) igual recibía el resto del goteo, contenido
    // que ya no correspondía a nada visible en público.
    if (lead.campaigns?.status !== 'active' || !lead.campaigns?.landings?.is_active) {
      await supabase.from('email_sends').update({ status: 'skipped' }).eq('id', envio.id).eq('status', 'pending');
      resultado.omitidos++;
      continue;
    }

    // Bug real confirmado (2026-08-24, Ronda 2) — sin este "reclamo"
    // atómico, dos ejecuciones concurrentes de processPendingEmails()
    // (el cron + el botón "Enviar pendientes ahora", o dos crons
    // solapados) podían leer el mismo email_sends 'pending' y mandarlo
    // dos veces por Brevo. El UPDATE condicional (pending → processing)
    // solo afecta una fila si nadie más la tomó todavía — si `claimed`
    // viene vacío, otra ejecución ya se la quedó, así que la saltamos.
    const { data: claimed } = await supabase
      .from('email_sends')
      .update({ status: 'processing', claimed_at: new Date().toISOString() })
      .eq('id', envio.id)
      .eq('status', 'pending')
      .select('id');

    if (!claimed || claimed.length === 0) {
      continue;
    }

    try {
      const whatsappUrl = `${webappUrl}/api/track?lead_id=${envio.lead_id}&step=${paso.step_number}`;
      // El diseño de email es opcional por paso — sin uno elegido, se
      // manda con el HTML "simple" de respaldo en vez de bloquear el
      // envío (ver HTML_EMAIL_BASE).
      const htmlBase = paso.email_templates?.html_content ?? HTML_EMAIL_BASE;
      const html = replacePlaceholders(htmlBase, {
        // nombre/apellido vienen del formulario público de /api/leads sin
        // filtrar caracteres (leadInputSchema solo exige que no estén
        // vacíos) — NO se escapan acá a mano: replacePlaceholders() (ver
        // lib/templates.ts) ya escapa TODO valor que recibe, así que
        // escaparlos también acá los dejaba doble-escapados en el email
        // real (bug real confirmado 2026-08-24, Ronda 2 — ej. un nombre
        // con "&" salía como "&amp;amp;").
        nombre: lead.first_name ?? '',
        apellido: lead.last_name ?? '',
        contenido: paso.content,
        whatsapp_url: whatsappUrl,
        asesora_nombre: lead.campaigns?.advisor_name ?? '',
      });

      const cuerpo = await enviarPorBrevo(apiKey, {
        sender: { name: cuenta.sender_name, email: cuenta.sender_email },
        to: [{ email: lead.email }],
        subject: paso.subject,
        htmlContent: html,
      });

      await supabase
        .from('email_sends')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          brevo_message_id: cuerpo.messageId ?? null,
          brevo_account_id: cuenta.id,
        })
        .eq('id', envio.id);

      resultado.enviados++;
    } catch (err) {
      await marcarError(supabase, envio.id, err instanceof Error ? err.message : String(err));
      resultado.errores++;
    }
  }

  return resultado;
}

/**
 * Bug real confirmado (2026-08-24, Ronda 2) — no había retry, backoff ni
 * timeout: cualquier error transitorio de Brevo (429 rate limit, 5xx,
 * timeout de red) se marcaba como 'error' PERMANENTE y nunca se
 * reintentaba, aunque el problema haya sido de un segundo. Reintenta
 * hasta 3 veces solo ante 429/5xx o error de red (nunca ante un 4xx que
 * no sea 429 — eso es un error real del payload, reintentarlo no cambia
 * nada), con backoff exponencial (500ms, 1s, 2s) y timeout de 15s por
 * intento vía AbortController.
 */
async function enviarPorBrevo(
  apiKey: string,
  body: { sender: { name: string; email: string }; to: { email: string }[]; subject: string; htmlContent: string }
): Promise<{ messageId?: string }> {
  const intentosMax = 3;

  for (let intento = 1; intento <= intentosMax; intento++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);

    try {
      const respuesta = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (respuesta.ok) {
        return await respuesta.json();
      }

      const texto = await respuesta.text();
      const reintentable = respuesta.status === 429 || respuesta.status >= 500;
      if (!reintentable || intento === intentosMax) {
        throw new Error(`Brevo respondió ${respuesta.status}: ${texto}`);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      const esAbort = err instanceof Error && err.name === 'AbortError';
      if (!esAbort && err instanceof Error && err.message.startsWith('Brevo respondió')) {
        // Ya decidimos arriba que no es reintentable o se acabaron los intentos.
        throw err;
      }
      if (intento === intentosMax) {
        throw esAbort ? new Error('Brevo no respondió a tiempo (timeout de 15s) tras 3 intentos.') : err;
      }
    }

    await new Promise((r) => setTimeout(r, 500 * 2 ** (intento - 1)));
  }

  // Inalcanzable en la práctica (el loop siempre retorna o tira antes),
  // pero TypeScript necesita un valor de retorno en todos los caminos.
  throw new Error('No se pudo enviar el email por Brevo.');
}

async function marcarError(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  envioId: string,
  mensaje: string
) {
  await supabase
    .from('email_sends')
    .update({ status: 'error', error_message: mensaje })
    .eq('id', envioId);
  console.error(`email_sends ${envioId}: ${mensaje}`);
}

/**
 * Bug real confirmado (2026-08-24) — rastro visible (tabla system_alerts,
 * ver supabase/migrations/0017_system_alerts.sql) para fallas de
 * CONFIGURACIÓN que cortan el envío de TODAS las campañas, no una fila
 * puntual de email_sends (eso ya lo cubre marcarError). Upsert por
 * `source`: mientras el problema siga, cada corrida del cron pisa
 * message/last_seen_at de la misma fila en vez de sumar una fila nueva por
 * corrida (el cron corre cada 1 hora — sin esto la tabla se llenaría de
 * filas idénticas). resolved_at se vuelve a poner en null en cada llamada,
 * así una fila resuelta a mano que vuelve a fallar se reabre sola.
 */
async function registrarAlerta(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  source: string,
  mensaje: string
) {
  const { error } = await supabase
    .from('system_alerts')
    .upsert(
      { source, message: mensaje, last_seen_at: new Date().toISOString(), resolved_at: null },
      { onConflict: 'source' }
    );
  if (error) console.error(`No se pudo registrar la alerta en system_alerts (${source}):`, error);
}
