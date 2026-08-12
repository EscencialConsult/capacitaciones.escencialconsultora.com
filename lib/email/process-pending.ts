import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { replacePlaceholders } from '@/lib/templates';
import { HTML_EMAIL_BASE } from '@/lib/landing-template-defaults';

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
export async function processPendingEmails() {
  const supabase = createSupabaseServiceClient();
  const resultado = { procesados: 0, enviados: 0, errores: 0 };

  const { data: pendientes, error } = await supabase
    .from('email_sends')
    .select(
      `id, lead_id, landing_email_step_id,
       leads(email, first_name, last_name, campaign_id, campaigns(advisor_name, whatsapp_number)),
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
    .select('env_var_name, sender_email, sender_name, id')
    .eq('is_active', true)
    .order('priority', { ascending: true })
    .limit(1)
    .single();

  if (!cuenta) {
    console.error('No hay ninguna cuenta de Brevo activa configurada.');
    return resultado;
  }

  const apiKey = process.env[cuenta.env_var_name];
  if (!apiKey) {
    console.error(`Falta la variable de entorno ${cuenta.env_var_name} con la API key de Brevo.`);
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
      campaigns: { advisor_name: string | null; whatsapp_number: string | null } | null;
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

    try {
      const whatsappUrl = `${webappUrl}/api/track?lead_id=${envio.lead_id}&step=${paso.step_number}`;
      // El diseño de email es opcional por paso — sin uno elegido, se
      // manda con el HTML "simple" de respaldo en vez de bloquear el
      // envío (ver HTML_EMAIL_BASE).
      const htmlBase = paso.email_templates?.html_content ?? HTML_EMAIL_BASE;
      const html = replacePlaceholders(htmlBase, {
        nombre: lead.first_name ?? '',
        apellido: lead.last_name ?? '',
        contenido: paso.content,
        whatsapp_url: whatsappUrl,
        asesora_nombre: lead.campaigns?.advisor_name ?? '',
      });

      const respuesta = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { name: cuenta.sender_name, email: cuenta.sender_email },
          to: [{ email: lead.email }],
          subject: paso.subject,
          htmlContent: html,
        }),
      });

      if (!respuesta.ok) {
        const texto = await respuesta.text();
        throw new Error(`Brevo respondió ${respuesta.status}: ${texto}`);
      }

      const cuerpo = await respuesta.json();

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
