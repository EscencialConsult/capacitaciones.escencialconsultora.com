'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServiceClient, requireAdmin } from '@/lib/supabase/server';
import { processPendingEmails } from '@/lib/email/process-pending';

const campaignSchema = z.object({
  name: z.string().trim().min(1, 'Falta el nombre interno.'),
  // A qué landing (el link público) pertenece esta campaña — el link/slug
  // en sí ya no se elige acá, es propiedad de la landing (ver
  // landings/actions.ts). Se elige una existente o se crea una nueva al
  // vuelo desde el modal "+ Crear landing nueva" en CampaignForm.
  landing_id: z.string().uuid('Elegí una landing.'),
  category_id: z.string().uuid().optional().or(z.literal('')),
  advisor_name: z.string().trim().optional().default(''),
  // Sin formato validado antes, un número vacío/con espacios/con "+" se
  // guardaba tal cual y app/api/track/route.ts lo interpolaba directo en
  // la URL de wa.me — el lead caía en un link roto o en la página
  // genérica de WhatsApp sin ningún aviso en todo el flujo (Bug real
  // confirmado 2026-08-24). Vacío se sigue permitiendo (el dato es
  // opcional), pero si se cargó algo, tiene que ser un número real.
  whatsapp_number: z
    .string()
    .trim()
    .optional()
    .default('')
    .refine((v) => v === '' || /^\d{8,15}$/.test(v), 'WhatsApp: solo números, sin +, espacios ni guiones (8 a 15 dígitos).'),
  // Mensaje PRELLENADO que manda EL LEAD al asesor por WhatsApp al
  // clickear el botón del email — el sistema nunca lo manda solo, ver
  // Script C del sistema viejo / app/api/track/route.ts acá.
  whatsapp_message: z.string().trim().optional().default(''),
  // Paso 1 es obligatorio (toda campaña manda al menos un email). Los
  // pasos 2 a 4 son opcionales — se saltean solos si asunto Y contenido
  // quedan vacíos, mismo criterio que template_base_N vacío en el
  // sistema viejo (nunca rellenar con texto tipo "N/A"). El DISEÑO de
  // email es opcional en los 4 — sin uno elegido, se manda con el HTML
  // simple de respaldo (ver HTML_EMAIL_BASE / process-pending.ts).
  step1_email_template_id: z.string().optional().default(''),
  step1_offset_days: z.coerce.number().int().min(0).default(0),
  step1_subject: z.string().trim().min(1, 'Falta el asunto del email 1.'),
  step1_content: z.string().trim().min(1, 'Falta el contenido del email 1.'),
  step2_email_template_id: z.string().optional().default(''),
  step2_offset_days: z.coerce.number().int().min(0).default(0),
  step2_subject: z.string().trim().optional().default(''),
  step2_content: z.string().trim().optional().default(''),
  step3_email_template_id: z.string().optional().default(''),
  step3_offset_days: z.coerce.number().int().min(0).default(0),
  step3_subject: z.string().trim().optional().default(''),
  step3_content: z.string().trim().optional().default(''),
  step4_email_template_id: z.string().optional().default(''),
  step4_offset_days: z.coerce.number().int().min(0).default(0),
  step4_subject: z.string().trim().optional().default(''),
  step4_content: z.string().trim().optional().default(''),
  // Ancla del offset (2026-08-28, pedido explícito) — solo pasos 2-4,
  // ver el comentario completo en CampaignForm.tsx → PasoExistente. El
  // paso 1 nunca lo manda el form (offset siempre 0, inmediato), así
  // que ni se le pide acá — parsePasos lo hardcodea a 'lead' abajo.
  step2_ancla: z.enum(['lead', 'campana']).default('lead'),
  step3_ancla: z.enum(['lead', 'campana']).default('lead'),
  step4_ancla: z.enum(['lead', 'campana']).default('lead'),
});

/**
 * Las variables de contenido (título, subtítulo, precio, lo que sea)
 * ya no son un set fijo — se leen directo de cualquier campo `var_*`
 * que haya en el formulario, sea cual sea la plantilla de la landing
 * elegida (esos campos los arma CampaignForm dinámicamente a partir de
 * landing.landing_templates.variables_schema). Nada que mantener
 * sincronizado acá.
 */
function extraerVariables(formData: FormData): Record<string, string> {
  const variables: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('var_') && typeof value === 'string') {
      variables[key.slice('var_'.length)] = value;
    }
  }
  return variables;
}

/**
 * Protección contra formularios desactualizados (2026-08-14, bug real
 * reportado por Facundo) — `updateCampaign`/`createCampaign` SOBRE-
 * ESCRIBEN por completo la columna `variables` con lo que venga en
 * `extraerVariables(formData)`. Esos campos `var_*` los arma
 * CampaignForm en el navegador a partir de `variables_schema` de la
 * plantilla EN EL MOMENTO EN QUE SE CARGÓ LA PÁGINA — si esa plantilla
 * se actualizó después (nuevas variables agregadas) y la pestaña quedó
 * abierta desde antes, el formulario nunca tiene inputs para las
 * variables nuevas, así que un guardado desde esa pestaña las descarta
 * en silencio (el submit ni siquiera las manda, no hay forma de
 * detectarlo del lado del campo en sí). Eso fue justo lo que pasó:
 * 104 variables reales pasaron a 66 sin ningún error.
 *
 * La única forma confiable de detectarlo es comparar, del lado del
 * servidor, qué claves llegaron contra las claves que la plantilla
 * ACTUAL de esa landing realmente tiene ahora mismo (fresco, no lo que
 * el navegador cree) — si no coinciden exacto, algo está desactualizado
 * y se bloquea el guardado en vez de aceptar un `variables` incompleto.
 */
async function validarVariablesActualizadas(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  landingId: string,
  formData: FormData
): Promise<{ error: string } | null> {
  const { data: landing } = await supabase
    .from('landings')
    .select('landing_templates(variables_schema)')
    .eq('id', landingId)
    .single();

  const schema =
    (landing?.landing_templates as unknown as { variables_schema: { key: string }[] } | null)
      ?.variables_schema ?? [];
  const clavesEsperadas = new Set(schema.map((v) => v.key));
  const clavesEnviadas = new Set(Object.keys(extraerVariables(formData)));

  const faltantes = [...clavesEsperadas].filter((k) => !clavesEnviadas.has(k));
  const sobrantes = [...clavesEnviadas].filter((k) => !clavesEsperadas.has(k));

  if (faltantes.length === 0 && sobrantes.length === 0) return null;

  return {
    error: `Esta pantalla quedó desactualizada respecto a la plantilla actual — ${
      faltantes.length > 0 ? `faltan ${faltantes.length} variable(s) que la plantilla sí tiene hoy` : `sobran ${sobrantes.length} variable(s) que la plantilla ya no tiene`
    } (probablemente la editaste hace rato y la dejaste abierta, o cambió después de cargar esta página). No se guardó nada para no perder contenido — recargá la página (F5) y volvé a completar/pegar el JSON ahí.`,
  };
}

/**
 * Server action liviana para el botón "Copiar prompt (datos de la
 * campaña)" de CopyLandingPromptButton — bug real confirmado
 * (2026-08-24, Ronda 2): ese botón armaba el prompt con el snapshot de
 * `variables_schema` que trae la pantalla desde que cargó, así que si la
 * plantilla se editaba en otra pestaña mientras esta quedaba abierta, el
 * prompt copiado no incluía las variables nuevas. Se llama justo antes
 * de copiar para traer el schema REAL y actual en vez de confiar en lo
 * que ya está en el navegador (mismo select que validarVariablesActualizadas
 * de arriba, pero de solo lectura — no bloquea nada, solo refresca).
 */
export async function obtenerVariablesSchemaFrescas(
  landingId: string
): Promise<{ key: string; label: string; description?: string }[]> {
  if (!(await requireAdmin())) return [];

  const supabase = createSupabaseServiceClient();
  const { data: landing } = await supabase
    .from('landings')
    .select('landing_templates(variables_schema)')
    .eq('id', landingId)
    .single();

  return (
    (
      landing?.landing_templates as unknown as {
        variables_schema: { key: string; label: string; description?: string }[];
      } | null
    )?.variables_schema ?? []
  );
}

function parsePasos(d: z.infer<typeof campaignSchema>) {
  return [
    { n: 1, email_template_id: d.step1_email_template_id, offset_days: d.step1_offset_days, subject: d.step1_subject, content: d.step1_content, ancla: 'lead' as const },
    { n: 2, email_template_id: d.step2_email_template_id, offset_days: d.step2_offset_days, subject: d.step2_subject, content: d.step2_content, ancla: d.step2_ancla },
    { n: 3, email_template_id: d.step3_email_template_id, offset_days: d.step3_offset_days, subject: d.step3_subject, content: d.step3_content, ancla: d.step3_ancla },
    { n: 4, email_template_id: d.step4_email_template_id, offset_days: d.step4_offset_days, subject: d.step4_subject, content: d.step4_content, ancla: d.step4_ancla },
  ].filter((p) => p.n === 1 || (p.subject.trim() !== '' && p.content.trim() !== ''));
}

/**
 * Bug real confirmado (2026-08-24) — en una landing de envío
 * personalizado, el HTML público SIEMPRE muestra las 4 opciones fijas
 * del <select> (ver HTML_BASE_ENVIO_PERSONALIZADO en
 * lib/landing-template-defaults.ts), sin importar cuáles de los 4 pasos
 * se completaron acá. `parsePasos` de arriba filtra en silencio
 * cualquier paso 2-4 que haya quedado sin asunto/contenido — así que si
 * un lead elige justo esa opción, app/api/leads/route.ts no encuentra
 * ningún landing_email_step para ese step_number y no le agenda NINGÚN
 * email, sin ningún error visible ni para el lead ni para el admin. Acá,
 * a diferencia del modo goteo normal, los 4 pasos son obligatorios.
 */
async function validarPasosCompletosSiEnvioPersonalizado(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  landingId: string,
  pasos: ReturnType<typeof parsePasos>
): Promise<{ error: string } | null> {
  const { data: landing } = await supabase
    .from('landings')
    .select('landing_templates(envio_personalizado)')
    .eq('id', landingId)
    .single();

  const esEnvioPersonalizado =
    (landing?.landing_templates as unknown as { envio_personalizado: boolean } | null)
      ?.envio_personalizado ?? false;

  if (!esEnvioPersonalizado) return null;

  const numerosPresentes = new Set(pasos.map((p) => p.n));
  const faltantes = [1, 2, 3, 4].filter((n) => !numerosPresentes.has(n));

  if (faltantes.length === 0) return null;

  return {
    error: `Esta landing es de envío personalizado: el lead puede elegir cualquiera de las 4 opciones del formulario público, así que las 4 necesitan asunto y contenido cargados. Falta completar la Opción ${faltantes.join(', ')}.`,
  };
}

/**
 * Toda campaña nueva arranca en 'draft' siempre — no está sirviendo
 * contenido todavía aunque su landing ya exista y esté activa. Pasar a
 * "campaña activa" es la acción separada activateCampaign, nunca un
 * valor que se elige acá.
 */
export async function createCampaign(_prevState: { error?: string } | undefined, formData: FormData) {
  if (!(await requireAdmin())) {
    return { error: 'No autorizado.' };
  }

  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = campaignSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' };
  }
  const d = parsed.data;
  const pasos = parsePasos(d);

  const supabase = createSupabaseServiceClient();

  const errorDesactualizado = await validarVariablesActualizadas(supabase, d.landing_id, formData);
  if (errorDesactualizado) return errorDesactualizado;

  const errorPasosIncompletos = await validarPasosCompletosSiEnvioPersonalizado(supabase, d.landing_id, pasos);
  if (errorPasosIncompletos) return errorPasosIncompletos;

  // Bug real confirmado (2026-08-24) — antes esto era el insert de
  // campaigns y el de landing_email_steps en dos llamadas HTTP
  // separadas: si la primera tenía éxito y la segunda fallaba (timeout,
  // blip transitorio de Supabase), quedaba una campaña real persistida
  // en 'draft' con CERO pasos de email, sin que nada lo impidiera más
  // adelante al activarla. crear_campana_con_pasos hace las dos
  // inserciones en un único statement atómico de Postgres — todo o
  // nada, mismo patrón que activar_campana (ver
  // supabase/migrations/0014_crear_campana_atomica.sql, todavía sin
  // aplicar a la base real).
  const { data: campaignId, error: campanaError } = await supabase.rpc('crear_campana_con_pasos', {
    p_landing_id: d.landing_id,
    p_name: d.name,
    p_category_id: d.category_id || null,
    p_advisor_name: d.advisor_name || null,
    p_whatsapp_number: d.whatsapp_number || null,
    p_whatsapp_message: d.whatsapp_message || null,
    p_variables: extraerVariables(formData),
    p_pasos: pasos.map((p) => ({
      step_number: p.n,
      email_template_id: p.email_template_id || null,
      offset_days: p.offset_days,
      subject: p.subject,
      content: p.content,
      ancla: p.ancla,
    })),
  });

  if (campanaError) {
    console.error('Error creando campaña:', campanaError);
    return { error: campanaError.message || 'No se pudo crear la campaña.' };
  }

  revalidatePath('/admin/campaigns');
  // Manda de vuelta a esta misma campaña recién creada (no a la lista)
  // — mismo criterio que updateCampaign de acá abajo, ver el comentario
  // ahí para el porqué completo.
  redirect(`/admin/campaigns/${campaignId}/edit?guardado=1`);
}

/**
 * Se puede editar una campaña en cualquier estado — activa, pausada,
 * lo que sea. Ya no hace falta pasar por "borrador" para corregir un
 * dato (antes quedaba todo fijo apenas se activaba). Los pasos de
 * email se actualizan en el lugar (upsert por campaign_id+step_number,
 * NUNCA delete-then-insert) para no romper la referencia de
 * email_sends.landing_email_step_id — si una campaña activa ya le
 * mandó un email real a algún lead por el paso 2, esa fila de
 * landing_email_steps tiene que seguir existiendo con el mismo id.
 * Solo se borra un paso si quedó vacío en el form Y nadie recibió
 * todavía un envío de ese paso puntual (si alguien ya lo recibió, el
 * borrado falla por la FK a propósito — ver el catch de 23503 abajo —
 * en vez de perder en silencio el historial de un envío ya hecho).
 */
export async function updateCampaign(
  campaignId: string,
  _prevState: { error?: string } | undefined,
  formData: FormData
) {
  const admin = await requireAdmin();
  if (!admin) {
    return { error: 'No autorizado.' };
  }

  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = campaignSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' };
  }
  const d = parsed.data;
  const pasos = parsePasos(d);

  const supabase = createSupabaseServiceClient();

  const errorDesactualizado = await validarVariablesActualizadas(supabase, d.landing_id, formData);
  if (errorDesactualizado) return errorDesactualizado;

  const errorPasosIncompletos = await validarPasosCompletosSiEnvioPersonalizado(supabase, d.landing_id, pasos);
  if (errorPasosIncompletos) return errorPasosIncompletos;

  // Bug real confirmado (2026-08-24) — si esta campaña ya está 'active' y
  // se le está cambiando la landing, esto es una re-activación real: la
  // landing destino tiene que quedar con esta como su única campaña
  // activa, igual que hace activateCampaign. Sin esto, movíamos una
  // campaña 'active' a una landing apagada (is_active=false) sin
  // prenderla —la campaña queda activa en el panel pero /slug sigue
  // dando 404— o, si la landing destino ya tenía otra campaña activa,
  // el update de abajo violaba el índice único sin ningún mensaje claro.
  const { data: campanaActual } = await supabase
    .from('campaigns')
    .select('status, landing_id')
    .eq('id', campaignId)
    .single();

  const cambiaLandingEnActiva =
    campanaActual?.status === 'active' && campanaActual.landing_id !== d.landing_id;

  // Bug real confirmado (2026-08-24) — esto eran dos pasos sueltos
  // (pausar acá + mover landing_id más abajo en el UPDATE general), cada
  // uno su propia transacción: una activación concurrente de OTRA
  // campaña hacia la MISMA landing destino podía colarse justo en el
  // medio y quedar pisada en silencio (o pisar a esta) sin que ningún
  // admin viera error. `mover_landing_y_activar` hace pausar-lo-viejo +
  // mover-landing_id + prender-la-landing en un único statement de
  // Postgres, con un `for update` que bloquea las campañas de la landing
  // destino y así serializa contra cualquier otro movimiento/activación
  // simultáneo (ver supabase/migrations/0009_activar_campana_atomica.sql).
  if (cambiaLandingEnActiva) {
    const { error: pauseError } = await supabase.rpc('mover_landing_y_activar', {
      p_campaign_id: campaignId,
      p_landing_id_nuevo: d.landing_id,
      p_activated_by: admin.id,
    });

    if (pauseError) {
      console.error('Error moviendo la campaña activa a la landing nueva:', pauseError);
      // Bug real confirmado (2026-08-24, Ronda 3) — antes esto mostraba
      // siempre el mismo texto fijo ("falló al pausar..."), que no tiene
      // nada que ver con la causa real si lo que pasó fue un choque de
      // concurrencia (ej. un deadlock entre dos movimientos cruzados de
      // landing, ver el comentario de mover_landing_y_activar en
      // supabase/migrations/0009_activar_campana_atomica.sql) en vez de
      // un fallo al pausar. Propagamos el mensaje real de Postgres, igual
      // que ya hace activateCampaign más abajo.
      return {
        error: pauseError.message || 'No se pudo mover la campaña a la landing nueva.',
      };
    }
  }

  const { error: campanaError } = await supabase
    .from('campaigns')
    .update({
      landing_id: d.landing_id,
      name: d.name,
      category_id: d.category_id || null,
      advisor_name: d.advisor_name || null,
      whatsapp_number: d.whatsapp_number || null,
      whatsapp_message: d.whatsapp_message || null,
      variables: extraerVariables(formData),
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId);

  if (campanaError) {
    console.error('Error actualizando campaña:', campanaError);
    if (campanaError.code === '23505') {
      return { error: 'No se pudo guardar: esa landing ya tiene otra campaña activa.' };
    }
    return { error: 'No se pudo guardar la campaña.' };
  }

  // Recién acá, con la campaña ya guardada apuntando a la landing nueva,
  // la prendemos por las dudas estuviera desactivada — mismo criterio
  // que activateCampaign.
  if (cambiaLandingEnActiva) {
    await supabase.from('landings').update({ is_active: true }).eq('id', d.landing_id);
    revalidatePath('/admin/landings');
  }

  const { error: upsertError } = await supabase.from('landing_email_steps').upsert(
    pasos.map((p) => ({
      campaign_id: campaignId,
      step_number: p.n,
      email_template_id: p.email_template_id || null,
      offset_days: p.offset_days,
      subject: p.subject,
      content: p.content,
      ancla: p.ancla,
    })),
    { onConflict: 'campaign_id,step_number' }
  );

  if (upsertError) {
    console.error('Error actualizando landing_email_steps:', upsertError);
    return { error: 'Se guardaron los datos generales, pero falló algún paso de email.' };
  }

  // Pasos que existían antes pero quedaron vacíos en este guardado
  // (el usuario borró el asunto/contenido del email 3, por ejemplo).
  const numerosActuales = pasos.map((p) => p.n);
  const { error: deleteError } = await supabase
    .from('landing_email_steps')
    .delete()
    .eq('campaign_id', campaignId)
    .not('step_number', 'in', `(${numerosActuales.join(',')})`);

  if (deleteError) {
    if (deleteError.code === '23503') {
      return {
        error:
          'Se guardó todo lo demás, pero no pude vaciar un paso de email que ya se le mandó a algún lead — dejalo con contenido en vez de borrarlo.',
      };
    }
    console.error('Error borrando pasos de email sobrantes:', deleteError);
    return { error: 'Se guardaron los datos generales, pero falló algún paso de email.' };
  }

  revalidatePath('/admin/campaigns');
  revalidatePath(`/admin/campaigns/${campaignId}/edit`);
  // Vuelve a ESTA campaña (no a la lista) — Facundo reportó no tener
  // forma fácil de confirmar que lo que acababa de guardar era
  // realmente lo último (sobre todo pegando un JSON grande armado con
  // una IA): antes esto mandaba a la lista, con el único rastro de
  // "¿guardó bien?" siendo volver a clickear Editar. Como esta página
  // es force-dynamic, este redirect fuerza una lectura 100% fresca de
  // la base (campaña + variables_schema actual de la plantilla) — no
  // puede haber una pestaña vieja de por medio mostrando datos
  // desactualizados. El ?guardado=1 dispara el banner con el link a la
  // landing en vivo para chequear a ojo que quedó bien.
  redirect(`/admin/campaigns/${campaignId}/edit?guardado=1`);
}

/**
 * "Activar" es lo que hace que una campaña empiece a servir contenido
 * de verdad en /{slug} de su landing (ver app/[slug]/route.ts, que
 * busca la campaña con status='active' de esa landing). Sirve tanto
 * para la primera activación (desde 'draft') como para reactivar una
 * campaña que se había pausado — en ambos casos la regla es la misma.
 * Como mucho una campaña activa por landing a la vez (reforzado también
 * a nivel base, ver campaigns_one_active_per_landing_idx) — activar
 * esta pausa cualquier otra que ya estuviera activa en la misma
 * landing, y prende la landing por las dudas estuviera desactivada.
 */
export async function activateCampaign(
  campaignId: string,
  // A dónde volver después de activar (2026-08-26, paso "Publicación" del
  // form) — por defecto la lista, de siempre. Cuando se activa desde
  // adentro del form de edición, se pasa la propia URL de edición para
  // quedarse ahí (con ?guardado=1, mismo mecanismo de "recién pasó algo,
  // veníte a confirmar" que ya usa guardar) en vez de sacar al admin de
  // la pantalla donde estaba viendo el estado de publicación.
  redirectTo: string = '/admin/campaigns'
) {
  const admin = await requireAdmin();
  if (!admin) {
    return { error: 'No autorizado.' };
  }

  const supabase = createSupabaseServiceClient();

  // Bug real confirmado (2026-08-24, Ronda 2) — la versión anterior hacía
  // leer-pausar-activar en TRES llamadas HTTP separadas, cada una su
  // propia transacción: una activación concurrente de OTRA campaña de la
  // MISMA landing podía colarse justo en el medio y pisar en silencio lo
  // que esta acababa de activar, sin que ningún admin viera error (el
  // revert-si-falla que había antes no alcanza para esto, porque acá no
  // "falla" nada — las dos escrituras individuales tienen éxito, solo que
  // en el orden equivocado). activar_campana() hace toda la transición
  // (leer, pausar lo viejo, activar lo nuevo, prender la landing) en un
  // único statement atómico de Postgres con `for update`, así que una
  // segunda activación concurrente queda esperando en vez de pisar (ver
  // supabase/migrations/0009_activar_campana_atomica.sql). Desde
  // 0014_crear_campana_atomica.sql también rechaza activar una campaña
  // sin ningún landing_email_steps activo — red de seguridad aparte del
  // fix de createCampaign, para cualquier campaña que haya quedado sin
  // pasos por otra vía.
  const { error } = await supabase.rpc('activar_campana', {
    p_campaign_id: campaignId,
    p_activated_by: admin.id,
  });

  if (error) {
    console.error('Error activando campaña:', error);
    return { error: error.message || 'No se pudo activar la campaña.' };
  }

  revalidatePath('/admin/campaigns');
  revalidatePath('/admin/landings');
  redirect(redirectTo);
}

/**
 * Pausar una campaña activa — deja de servirse en /{slug} de inmediato
 * (app/[slug]/route.ts solo busca status='active'), pero a diferencia
 * de archivar, una pausada se puede reactivar con un click (ver
 * activateCampaign arriba). No toca la landing: puede seguir habiendo
 * otras campañas o quedar sin ninguna activa, cualquiera de los dos es
 * un estado válido para una landing.
 */
export async function pauseCampaign(campaignId: string) {
  if (!(await requireAdmin())) {
    return { error: 'No autorizado.' };
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from('campaigns')
    .update({ status: 'paused', updated_at: new Date().toISOString() })
    .eq('id', campaignId)
    .eq('status', 'active')
    .select('id');

  if (error) {
    console.error('Error pausando campaña:', error);
    return { error: 'No se pudo pausar la campaña.' };
  }

  // Bug real confirmado (2026-08-24, Ronda 2) — el UPDATE condicional
  // (.eq('status','active')) no devuelve error si la condición no
  // matcheaba (ej. otro admin ya la había pausado/archivado un segundo
  // antes) — Postgres/PostgREST responde éxito igual con 0 filas
  // afectadas, así que antes esto devolvía "éxito" sin haber cambiado
  // nada. Chequeamos `data` (con `.select('id')`) para distinguirlo.
  if (!data || data.length === 0) {
    return { error: 'Esta campaña ya no está activa — recargá la página para ver su estado real.' };
  }

  revalidatePath('/admin/campaigns');
}

/**
 * Archivar — "esta campaña ya cumplió su ciclo, no la voy a reactivar
 * ni a seguir usando de referencia activa" (a diferencia de pausar, que
 * es una interrupción temporal). Se puede archivar desde cualquier
 * estado salvo ya archivada; si estaba activa, deja de servirse en
 * /{slug} igual que al pausar. No es un paso previo obligatorio para
 * eliminar — se puede eliminar directo si no hay datos conectados que
 * lo bloqueen (ver deleteCampaign) — pero para una campaña con leads o
 * emails ya enviados, archivar es la única forma de "cerrarla" sin
 * perder ese historial, porque el borrado real ahí va a estar
 * bloqueado por la base a propósito.
 */
export async function archiveCampaign(campaignId: string) {
  if (!(await requireAdmin())) {
    return { error: 'No autorizado.' };
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from('campaigns')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', campaignId)
    .neq('status', 'archived')
    .select('id');

  if (error) {
    console.error('Error archivando campaña:', error);
    return { error: 'No se pudo archivar la campaña.' };
  }

  // Mismo caso que pauseCampaign — el UPDATE condicional no avisa si no
  // afectó ninguna fila (ej. ya estaba archivada).
  if (!data || data.length === 0) {
    return { error: 'Esta campaña ya está archivada — recargá la página para ver su estado real.' };
  }

  revalidatePath('/admin/campaigns');
}

/**
 * Borrado real (2026-08-14) — protegido por la base, no por acá: leads
 * apunta a campaigns sin cascada (ver
 * supabase/migrations/0004_separar_campanas_de_landings.sql), así que
 * una campaña con al menos un lead real rechaza el delete con 23503.
 * landing_email_steps sí tiene cascada desde campaigns, pero
 * email_sends apunta a landing_email_steps SIN cascada (ver
 * supabase/migrations/0001_init.sql) — así que si esta campaña ya tuvo
 * algún email enviado/agendado, el intento de cascada hacia
 * landing_email_steps se frena ahí, mismo código de error. En los dos
 * casos la única forma de "cerrar" la campaña es archivarla (ver
 * archiveCampaign), no borrarla. La UI (DeleteButton) ya pide
 * confirmación aparte antes de llamar esto — acá no hace falta pedirla
 * de nuevo.
 */
export async function deleteCampaign(campaignId: string) {
  if (!(await requireAdmin())) {
    return { error: 'No autorizado.' };
  }

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from('campaigns').delete().eq('id', campaignId);

  if (error) {
    if (error.code === '23503') {
      return {
        error:
          'No se puede eliminar: ya tiene leads reales o emails enviados/agendados. Para conservar ese historial, archivala en vez de eliminarla.',
      };
    }
    console.error('Error eliminando campaña:', error);
    return { error: 'No se pudo eliminar la campaña.' };
  }

  revalidatePath('/admin/campaigns');
}

/**
 * Reintentar un envío puntual que quedó en 'error' (2026-08-26, pedido
 * explícito desde la pantalla de leads) — lo vuelve a 'pending' (limpia
 * error_message y claimed_at) y corre processPendingEmails() al toque,
 * en vez de solo dejarlo agendado para la próxima pasada del cron
 * (hasta 1 hora de espera, sin necesidad). Reutiliza toda la lógica de
 * envío real (elegir cuenta según el dueño de la campaña, reintentos
 * con backoff) — no hay un camino de envío aparte para esto.
 *
 * El `.eq('status', 'error')` en el UPDATE es a propósito: si por lo
 * que sea esta fila ya no está en 'error' (otra pestaña la reintentó
 * primero, o el cron la tomó justo ahora), este UPDATE no afecta nada
 * y processPendingEmails() de abajo simplemente no encuentra nada
 * nuevo que hacer con ella — no hay forma de mandarla dos veces por
 * un click duplicado.
 */
export async function reintentarEnvio(emailSendId: string) {
  if (!(await requireAdmin())) {
    return { error: 'No autorizado.' };
  }

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from('email_sends')
    .update({ status: 'pending', error_message: null, claimed_at: null })
    .eq('id', emailSendId)
    .eq('status', 'error');

  if (error) {
    console.error('Error reintentando envío:', error);
    return { error: 'No se pudo reintentar. Probá de nuevo.' };
  }

  const resultado = await processPendingEmails();
  revalidatePath('/admin/campaigns/[id]/leads', 'page');
  return resultado;
}

// Fila ya mapeada y limpia — SubirLeadsButton.tsx hace el parseo del
// archivo y el mapeo de columnas del lado del cliente (no hace falta
// mandar el archivo entero al server, ni conocer acá el formato de
// ningún CRM en particular). `email` puede venir null (contacto solo
// con teléfono, ver migración 0033) — el resto de los campos son
// texto libre, igual que el form público.
const filaImportarSchema = z.object({
  email: z.string().trim().max(254).nullable(),
  nombre: z.string().trim().max(200).nullable(),
  apellido: z.string().trim().max(200).nullable(),
  telefono: z.string().trim().max(200).nullable(),
});
type FilaImportar = z.infer<typeof filaImportarSchema>;

/**
 * Carga masiva de leads (2026-08-31, pedido explícito: "así como está
 * hecho ahora pero el leads, lo cargo yo") — mismo camino que el form
 * público de la landing (registrar_lead vía RPC), fila por fila: misma
 * cadencia, mismo dedupe por email/teléfono, mismos créditos. Cero
 * lógica de envío nueva — un lead cargado acá entra exactamente igual
 * que uno que se registró solo.
 *
 * Solo en campañas ACTIVAS y de goteo normal (no envío personalizado):
 * el envío personalizado necesita que el lead elija una opción, algo
 * que una fila de CSV no tiene forma de contestar. Solo activas porque
 * `scheduled_for` se calcula EN ESTE MOMENTO contra `activated_at` —
 * cargar leads en una campaña todavía sin activar dejaría fechas mal
 * calculadas que nadie recalcula después al activarla (mismo motivo
 * por el que el form público solo funciona con la campaña activa).
 *
 * Corta apenas se queda sin crédito (2026-08-26, ver sistema de
 * créditos) — si la fila 50 de 500 ya no tiene crédito disponible en
 * este ciclo, las 450 siguientes tampoco lo van a tener: seguir
 * intentando solo gastaría 450 round-trips a la base para nada.
 */
export async function importarLeads(campaignId: string, filasCrudas: unknown[]) {
  if (!(await requireAdmin())) {
    return { error: 'No autorizado.' };
  }

  if (!Array.isArray(filasCrudas) || filasCrudas.length === 0) {
    return { error: 'No hay filas para importar.' };
  }
  if (filasCrudas.length > 5000) {
    return { error: 'Demasiadas filas en un solo archivo (máximo 5000) — dividilo en partes más chicas.' };
  }

  const filas: FilaImportar[] = [];
  for (const cruda of filasCrudas) {
    const parsed = filaImportarSchema.safeParse(cruda);
    // El cliente (SubirLeadsButton.tsx) ya descarta las filas sin ningún
    // dato útil antes de mandarlas — este chequeo es solo el mismo
    // filtro repetido del lado del servidor, por las dudas.
    if (parsed.success && (parsed.data.email || parsed.data.nombre || parsed.data.apellido || parsed.data.telefono)) {
      filas.push(parsed.data);
    }
  }
  if (filas.length === 0) {
    return { error: 'Ninguna fila tiene un formato válido.' };
  }

  const supabase = createSupabaseServiceClient();

  const { data: campana, error: campanaError } = await supabase
    .from('campaigns')
    .select('id, status, landings(landing_templates(envio_personalizado))')
    .eq('id', campaignId)
    .single();

  if (campanaError || !campana) {
    return { error: 'La campaña no existe.' };
  }
  if (campana.status !== 'active') {
    return {
      error: 'Esta campaña no está activa — activala primero (así los emails se agendan con la fecha correcta) y volvé a cargar el archivo.',
    };
  }

  const landing = campana.landings as unknown as {
    landing_templates: { envio_personalizado: boolean } | null;
  } | null;
  if (landing?.landing_templates?.envio_personalizado) {
    return {
      error:
        'Esta campaña es de envío personalizado (el lead elige una opción) — la carga masiva todavía no está disponible para este tipo de campaña.',
    };
  }

  let nuevos = 0;
  let duplicados = 0;
  let sinEmail = 0;
  let sinCredito = false;
  let noProcesados = 0;

  for (const fila of filas) {
    if (sinCredito) {
      noProcesados++;
      continue;
    }

    const { data: resultado, error } = await supabase.rpc('registrar_lead', {
      p_campaign_id: campaignId,
      p_email: fila.email ?? '',
      p_first_name: fila.nombre,
      p_last_name: fila.apellido,
      p_phone: fila.telefono ?? '',
      p_selected_option: null,
      p_envio_personalizado: false,
    });

    if (error || !resultado) {
      console.error('Error en registrar_lead (carga masiva):', error);
      noProcesados++;
      continue;
    }

    const r = resultado as { es_duplicado: boolean; sin_credito?: boolean };
    if (r.sin_credito) {
      sinCredito = true;
      noProcesados++;
      continue;
    }
    if (r.es_duplicado) {
      duplicados++;
    } else {
      nuevos++;
      if (!fila.email) sinEmail++;
    }
  }

  revalidatePath('/admin/campaigns/[id]/leads', 'page');

  return {
    ok: true as const,
    total: filas.length,
    nuevos,
    duplicados,
    sinEmail,
    sinCredito,
    noProcesados,
  };
}

/**
 * Marcar un lead puntual como vendido (2026-08-31, pedido explícito:
 * "así no se le siga enviando los emails de las campañas") — botón por
 * fila en la tabla de leads. Cancela ('skipped') lo que todavía no se
 * mandó de ese lead; lo ya enviado queda como estaba, no se puede
 * "desenviar". Ver migración 0034 — la marca y la cancelación son UNA
 * sola transacción en la base (marcar_lead_vendido), no dos escrituras
 * sueltas desde acá.
 */
export async function marcarLeadVendido(leadId: string) {
  if (!(await requireAdmin())) {
    return { error: 'No autorizado.' };
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.rpc('marcar_lead_vendido', { p_lead_id: leadId });

  if (error || !data) {
    console.error('Error en marcar_lead_vendido:', error);
    return { error: 'No se pudo marcar como vendido.' };
  }

  const r = data as { error?: string; ok?: boolean; ya_estaba?: boolean };
  if (r.error === 'no_existe') {
    return { error: 'Este lead ya no existe.' };
  }

  revalidatePath('/admin/campaigns/[id]/leads', 'page');
  return { ok: true as const, yaEstaba: r.ya_estaba ?? false };
}

/**
 * Marcar vendidos en lote, por email, resubiendo el mismo tipo de
 * archivo que "Cargar leads" (2026-08-31) — MarcarVendidosButton.tsx
 * hace el parseo, el mapeo de columnas y el filtro por el valor de
 * "Estado" del lado del cliente; acá solo llega la lista final de
 * emails a marcar, ya limpia. Un solo round-trip a la base para todo
 * el lote (marcar_vendidos_por_email, ver migración 0034) — nada de un
 * `for` llamando la base fila por fila como en importarLeads (ahí hace
 * falta porque cada fila puede crear un lead distinto con su propio
 * agendado; acá es un solo UPDATE masivo, no hay nada que agendar).
 */
export async function marcarVendidosDesdeArchivo(campaignId: string, emailsCrudos: unknown[]) {
  if (!(await requireAdmin())) {
    return { error: 'No autorizado.' };
  }

  if (!Array.isArray(emailsCrudos) || emailsCrudos.length === 0) {
    return { error: 'No hay emails para marcar.' };
  }
  if (emailsCrudos.length > 5000) {
    return { error: 'Demasiados emails en un solo archivo (máximo 5000) — dividilo en partes más chicas.' };
  }

  const emails = Array.from(
    new Set(
      emailsCrudos
        .filter((e): e is string => typeof e === 'string')
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0 && e.length <= 254)
    )
  );
  if (emails.length === 0) {
    return { error: 'Ningún email tiene un formato válido.' };
  }

  const supabase = createSupabaseServiceClient();
  const { data: campana, error: campanaError } = await supabase
    .from('campaigns')
    .select('id')
    .eq('id', campaignId)
    .single();
  if (campanaError || !campana) {
    return { error: 'La campaña no existe.' };
  }

  const { data, error } = await supabase.rpc('marcar_vendidos_por_email', {
    p_campaign_id: campaignId,
    p_emails: emails,
  });

  if (error || !data) {
    console.error('Error en marcar_vendidos_por_email:', error);
    return { error: 'No se pudo procesar el archivo.' };
  }

  const r = data as { marcados: number; encontrados: number };
  revalidatePath('/admin/campaigns/[id]/leads', 'page');

  return {
    ok: true as const,
    totalEmails: emails.length,
    encontrados: r.encontrados,
    marcados: r.marcados,
    yaEstaban: r.encontrados - r.marcados,
    noEncontrados: emails.length - r.encontrados,
  };
}
