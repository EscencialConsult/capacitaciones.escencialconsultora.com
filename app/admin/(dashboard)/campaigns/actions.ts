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
 * Solo se puede editar una campaña mientras sigue en 'draft' — una vez
 * activada, el contenido queda fijo y la pantalla de esa campaña pasa a
 * ser de analytics/leads, no de edición (ver campaigns/[id]/leads). El
 * chequeo se repite acá server-side, no solo ocultando el link en la UI.
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

  const { data: actual } = await supabase.from('campaigns').select('status').eq('id', campaignId).single();
  if (!actual || actual.status !== 'draft') {
    return { error: 'Esta campaña ya está activa — el contenido no se puede editar más desde acá.' };
  }

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

  // Se reemplazan todos los pasos — más simple y seguro que tratar de
  // diffear altas/bajas/cambios paso por paso, y de todos modos ningún
  // email_send pudo haberse generado todavía (la campaña ni es 'active').
  await supabase.from('landing_email_steps').delete().eq('campaign_id', campaignId);
  const { error: stepError } = await supabase.from('landing_email_steps').insert(
    pasos.map((p) => ({
      campaign_id: campaignId,
      step_number: p.n,
      email_template_id: p.email_template_id || null,
      offset_days: p.offset_days,
      subject: p.subject,
      content: p.content,
    }))
  );

  if (stepError) {
    console.error('Error actualizando landing_email_steps:', stepError);
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
