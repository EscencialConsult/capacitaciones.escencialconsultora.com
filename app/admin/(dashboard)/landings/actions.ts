'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { processPendingEmails } from '@/lib/email/process-pending';

// Slugs que nunca pueden ser el nombre de una landing — colisionan con
// rutas reales de la app (ver app/[slug]/route.ts).
const SLUGS_RESERVADOS = ['admin', 'api'];

const createLandingSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, 'El link solo puede tener minúsculas, números y guiones.')
    .refine((s) => !SLUGS_RESERVADOS.includes(s), 'Ese link está reservado, elegí otro.'),
  name: z.string().trim().min(1, 'Falta el nombre interno.'),
  template_id: z.string().uuid('Elegí una plantilla.'),
  status: z.enum(['draft', 'active']),
  advisor_name: z.string().trim().optional().default(''),
  whatsapp_number: z.string().trim().optional().default(''),
  // Mensaje PRELLENADO que manda EL LEAD al asesor por WhatsApp al
  // clickear el botón del email — el sistema nunca lo manda solo, ver
  // Script C del sistema viejo / app/api/track/route.ts acá.
  whatsapp_message: z.string().trim().optional().default(''),
  var_titulo: z.string().trim().optional().default(''),
  var_subtitulo: z.string().trim().optional().default(''),
  var_boton_texto: z.string().trim().optional().default('Enviar'),
  // Paso 1 es obligatorio (toda landing manda al menos un email). Los
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

export async function createLanding(_prevState: { error?: string } | undefined, formData: FormData) {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = createLandingSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' };
  }
  const d = parsed.data;

  // Se valida y arma ANTES de tocar la base — si falta el diseño de un
  // paso, no queremos una landing a medio crear sin sus emails.
  const pasos = [
    { n: 1, email_template_id: d.step1_email_template_id, offset_days: d.step1_offset_days, subject: d.step1_subject, content: d.step1_content },
    { n: 2, email_template_id: d.step2_email_template_id, offset_days: d.step2_offset_days, subject: d.step2_subject, content: d.step2_content },
    { n: 3, email_template_id: d.step3_email_template_id, offset_days: d.step3_offset_days, subject: d.step3_subject, content: d.step3_content },
    { n: 4, email_template_id: d.step4_email_template_id, offset_days: d.step4_offset_days, subject: d.step4_subject, content: d.step4_content },
  ].filter((p) => p.n === 1 || (p.subject.trim() !== '' && p.content.trim() !== ''));

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
      status: d.status,
      advisor_name: d.advisor_name || null,
      whatsapp_number: d.whatsapp_number || null,
      whatsapp_message: d.whatsapp_message || null,
      variables: { titulo: d.var_titulo, subtitulo: d.var_subtitulo, boton_texto: d.var_boton_texto },
    })
    .select('id')
    .single();

  if (landingError) {
    if (landingError.code === '23505') {
      return { error: 'Ya existe una landing con ese link.' };
    }
    console.error('Error creando landing:', landingError);
    return { error: 'No se pudo crear la landing.' };
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
    return { error: 'La landing se creó, pero falló algún paso de email. Revisala en la lista.' };
  }

  revalidatePath('/admin/landings');
  redirect('/admin/landings');
}

/**
 * Botón manual "Enviar pendientes ahora" — misma lógica que corre el
 * cron cada 1 hora, pero disparada a mano para poder probar sin esperar
 * ni depender de un deploy. Solo accesible desde /admin (ya protegido
 * por el middleware de sesión).
 */
export async function sendPendingNow() {
  const resultado = await processPendingEmails();
  revalidatePath('/admin/landings');
  return resultado;
}
