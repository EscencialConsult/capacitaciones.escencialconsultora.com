'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

const campaignSchema = z.object({
  name: z.string().trim().min(1, 'Falta el nombre interno.'),
  // A qué landing (el link público) pertenece esta campaña — el link/slug
  // en sí ya no se elige acá, es propiedad de la landing (ver
  // landings/actions.ts). Se elige una existente o se crea una nueva al
  // vuelo desde el modal "+ Crear landing nueva" en CampaignForm.
  landing_id: z.string().uuid('Elegí una landing.'),
  advisor_name: z.string().trim().optional().default(''),
  whatsapp_number: z.string().trim().optional().default(''),
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

function parsePasos(d: z.infer<typeof campaignSchema>) {
  return [
    { n: 1, email_template_id: d.step1_email_template_id, offset_days: d.step1_offset_days, subject: d.step1_subject, content: d.step1_content },
    { n: 2, email_template_id: d.step2_email_template_id, offset_days: d.step2_offset_days, subject: d.step2_subject, content: d.step2_content },
    { n: 3, email_template_id: d.step3_email_template_id, offset_days: d.step3_offset_days, subject: d.step3_subject, content: d.step3_content },
    { n: 4, email_template_id: d.step4_email_template_id, offset_days: d.step4_offset_days, subject: d.step4_subject, content: d.step4_content },
  ].filter((p) => p.n === 1 || (p.subject.trim() !== '' && p.content.trim() !== ''));
}

/**
 * Toda campaña nueva arranca en 'draft' siempre — no está sirviendo
 * contenido todavía aunque su landing ya exista y esté activa. Pasar a
 * "campaña activa" es la acción separada activateCampaign, nunca un
 * valor que se elige acá.
 */
export async function createCampaign(_prevState: { error?: string } | undefined, formData: FormData) {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = campaignSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' };
  }
  const d = parsed.data;
  const pasos = parsePasos(d);

  const supabase = createSupabaseServiceClient();

  const { data: campana, error: campanaError } = await supabase
    .from('campaigns')
    .insert({
      landing_id: d.landing_id,
      name: d.name,
      status: 'draft',
      advisor_name: d.advisor_name || null,
      whatsapp_number: d.whatsapp_number || null,
      whatsapp_message: d.whatsapp_message || null,
      variables: extraerVariables(formData),
    })
    .select('id')
    .single();

  if (campanaError) {
    console.error('Error creando campaña:', campanaError);
    return { error: 'No se pudo crear la campaña.' };
  }

  const { error: stepError } = await supabase.from('landing_email_steps').insert(
    pasos.map((p) => ({
      campaign_id: campana.id,
      step_number: p.n,
      email_template_id: p.email_template_id || null,
      offset_days: p.offset_days,
      subject: p.subject,
      content: p.content,
    }))
  );

  if (stepError) {
    console.error('Error creando landing_email_steps:', stepError);
    return { error: 'La campaña se creó, pero falló algún paso de email. Revisala en la lista.' };
  }

  revalidatePath('/admin/campaigns');
  redirect('/admin/campaigns');
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
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = campaignSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' };
  }
  const d = parsed.data;
  const pasos = parsePasos(d);

  const supabase = createSupabaseServiceClient();

  const { error: campanaError } = await supabase
    .from('campaigns')
    .update({
      landing_id: d.landing_id,
      name: d.name,
      advisor_name: d.advisor_name || null,
      whatsapp_number: d.whatsapp_number || null,
      whatsapp_message: d.whatsapp_message || null,
      variables: extraerVariables(formData),
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId);

  if (campanaError) {
    console.error('Error actualizando campaña:', campanaError);
    return { error: 'No se pudo guardar la campaña.' };
  }

  const { error: upsertError } = await supabase.from('landing_email_steps').upsert(
    pasos.map((p) => ({
      campaign_id: campaignId,
      step_number: p.n,
      email_template_id: p.email_template_id || null,
      offset_days: p.offset_days,
      subject: p.subject,
      content: p.content,
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
  redirect('/admin/campaigns');
}

/**
 * "Activar" es lo que hace que una campaña empiece a servir contenido
 * de verdad en /{slug} de su landing (ver app/[slug]/route.ts, que
 * busca la campaña con status='active' de esa landing). Como mucho una
 * campaña activa por landing a la vez (reforzado también a nivel base,
 * ver campaigns_one_active_per_landing_idx) — activar esta pausa
 * cualquier otra que ya estuviera activa en la misma landing, y prende
 * la landing por las dudas estuviera desactivada.
 */
export async function activateCampaign(campaignId: string) {
  const supabase = createSupabaseServiceClient();

  const { data: campana } = await supabase
    .from('campaigns')
    .select('id, landing_id, status')
    .eq('id', campaignId)
    .single();

  if (!campana) {
    return { error: 'No se encontró la campaña.' };
  }
  if (campana.status !== 'draft') {
    return { error: 'Solo se puede activar una campaña que esté en borrador.' };
  }

  await supabase
    .from('campaigns')
    .update({ status: 'paused', updated_at: new Date().toISOString() })
    .eq('landing_id', campana.landing_id)
    .eq('status', 'active')
    .neq('id', campaignId);

  const { error } = await supabase
    .from('campaigns')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', campaignId)
    .eq('status', 'draft');

  if (error) {
    console.error('Error activando campaña:', error);
    return { error: 'No se pudo activar la campaña.' };
  }

  await supabase.from('landings').update({ is_active: true }).eq('id', campana.landing_id);

  revalidatePath('/admin/campaigns');
  revalidatePath('/admin/landings');
  redirect('/admin/campaigns');
}
