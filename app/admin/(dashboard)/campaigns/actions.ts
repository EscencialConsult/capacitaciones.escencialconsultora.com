'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

// Slugs que nunca pueden ser el nombre de una landing — colisionan con
// rutas reales de la app (ver app/[slug]/route.ts).
const SLUGS_RESERVADOS = ['admin', 'api'];

const campaignSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, 'El link solo puede tener minúsculas, números y guiones.')
    .refine((s) => !SLUGS_RESERVADOS.includes(s), 'Ese link está reservado, elegí otro.'),
  name: z.string().trim().min(1, 'Falta el nombre interno.'),
  template_id: z.string().uuid('Elegí una plantilla.'),
  advisor_name: z.string().trim().optional().default(''),
  whatsapp_number: z.string().trim().optional().default(''),
  // Mensaje PRELLENADO que manda EL LEAD al asesor por WhatsApp al
  // clickear el botón del email — el sistema nunca lo manda solo, ver
  // Script C del sistema viejo / app/api/track/route.ts acá.
  whatsapp_message: z.string().trim().optional().default(''),
  var_titulo: z.string().trim().optional().default(''),
  var_subtitulo: z.string().trim().optional().default(''),
  var_boton_texto: z.string().trim().optional().default('Enviar'),
  // Paso 1 es obligatorio (toda campaña manda al menos un email). Los
  // pasos 2 a 4 son opcionales — se saltean solos si asunto Y contenido
  // quedan vacíos, mismo criterio que template_base_N vacío en el
  // sistema viejo (nunca rellenar con texto tipo "N/A").
  step1_email_template_id: z.string().uuid('Elegí una plantilla de email.'),
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

function parsePasos(d: z.infer<typeof campaignSchema>) {
  return [
    { n: 1, email_template_id: d.step1_email_template_id, offset_days: d.step1_offset_days, subject: d.step1_subject, content: d.step1_content },
    { n: 2, email_template_id: d.step2_email_template_id, offset_days: d.step2_offset_days, subject: d.step2_subject, content: d.step2_content },
    { n: 3, email_template_id: d.step3_email_template_id, offset_days: d.step3_offset_days, subject: d.step3_subject, content: d.step3_content },
    { n: 4, email_template_id: d.step4_email_template_id, offset_days: d.step4_offset_days, subject: d.step4_subject, content: d.step4_content },
  ].filter((p) => p.n === 1 || (p.subject.trim() !== '' && p.content.trim() !== ''));
}

/**
 * Toda campaña nueva arranca en 'draft' siempre — no existe un link
 * público todavía. Pasar a landing activa es la acción separada
 * activateCampaign, nunca un valor que se elige acá.
 */
export async function createLanding(_prevState: { error?: string } | undefined, formData: FormData) {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = campaignSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' };
  }
  const d = parsed.data;

  const pasos = parsePasos(d);
  const pasoSinDiseno = pasos.find((p) => !p.email_template_id);
  if (pasoSinDiseno) {
    return { error: `Falta elegir el diseño de email para el paso ${pasoSinDiseno.n}.` };
  }

  const supabase = createSupabaseServiceClient();

  const { data: landing, error: landingError } = await supabase
    .from('landings')
    .insert({
      slug: d.slug,
      name: d.name,
      template_id: d.template_id,
      status: 'draft',
      advisor_name: d.advisor_name || null,
      whatsapp_number: d.whatsapp_number || null,
      whatsapp_message: d.whatsapp_message || null,
      variables: { titulo: d.var_titulo, subtitulo: d.var_subtitulo, boton_texto: d.var_boton_texto },
    })
    .select('id')
    .single();

  if (landingError) {
    if (landingError.code === '23505') {
      return { error: 'Ya existe una campaña con ese link.' };
    }
    console.error('Error creando campaña:', landingError);
    return { error: 'No se pudo crear la campaña.' };
  }

  const { error: stepError } = await supabase.from('landing_email_steps').insert(
    pasos.map((p) => ({
      landing_id: landing.id,
      step_number: p.n,
      email_template_id: p.email_template_id,
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
 * activada, el contenido queda fijo y la pantalla de esa landing pasa a
 * ser de analytics, no de edición (ver landings/page.tsx). El chequeo se
 * repite acá server-side, no solo ocultando el link en la UI.
 */
export async function updateLanding(
  landingId: string,
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
  const pasoSinDiseno = pasos.find((p) => !p.email_template_id);
  if (pasoSinDiseno) {
    return { error: `Falta elegir el diseño de email para el paso ${pasoSinDiseno.n}.` };
  }

  const supabase = createSupabaseServiceClient();

  const { data: actual } = await supabase.from('landings').select('status').eq('id', landingId).single();
  if (!actual || actual.status !== 'draft') {
    return { error: 'Esta campaña ya está activa — el contenido no se puede editar más desde acá.' };
  }

  const { error: landingError } = await supabase
    .from('landings')
    .update({
      slug: d.slug,
      name: d.name,
      template_id: d.template_id,
      advisor_name: d.advisor_name || null,
      whatsapp_number: d.whatsapp_number || null,
      whatsapp_message: d.whatsapp_message || null,
      variables: { titulo: d.var_titulo, subtitulo: d.var_subtitulo, boton_texto: d.var_boton_texto },
      updated_at: new Date().toISOString(),
    })
    .eq('id', landingId);

  if (landingError) {
    if (landingError.code === '23505') {
      return { error: 'Ya existe otra campaña con ese link.' };
    }
    console.error('Error actualizando campaña:', landingError);
    return { error: 'No se pudo guardar la campaña.' };
  }

  // Se reemplazan todos los pasos — más simple y seguro que tratar de
  // diffear altas/bajas/cambios paso por paso, y de todos modos ningún
  // email_send pudo haberse generado todavía (la campaña ni es 'active').
  await supabase.from('landing_email_steps').delete().eq('landing_id', landingId);
  const { error: stepError } = await supabase.from('landing_email_steps').insert(
    pasos.map((p) => ({
      landing_id: landingId,
      step_number: p.n,
      email_template_id: p.email_template_id,
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
 * "Activar" es lo único que convierte una campaña en landing de verdad:
 * a partir de acá /{slug} responde de verdad (ver app/[slug]/route.ts,
 * que solo sirve landings con status='active') y esa fila pasa a
 * aparecer en /admin/landings en vez de en /admin/campaigns.
 */
export async function activateCampaign(landingId: string) {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from('landings')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', landingId)
    .eq('status', 'draft');

  if (error) {
    console.error('Error activando campaña:', error);
    return { error: 'No se pudo activar la campaña.' };
  }

  revalidatePath('/admin/campaigns');
  revalidatePath('/admin/landings');
  redirect('/admin/landings');
}
