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
  whatsapp_message: z.string().trim().optional().default(''),
  variables_json: z.string().trim().min(1),
  step1_email_template_id: z.string().uuid('Elegí una plantilla de email.'),
  step1_subject: z.string().trim().min(1, 'Falta el asunto del email 1.'),
  step1_content: z.string().trim().min(1, 'Falta el contenido del email 1.'),
});

export async function createLanding(_prevState: { error?: string } | undefined, formData: FormData) {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = createLandingSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' };
  }

  let variables: Record<string, unknown>;
  try {
    variables = JSON.parse(parsed.data.variables_json);
  } catch {
    return { error: 'El JSON de variables no es válido.' };
  }

  const supabase = createSupabaseServiceClient();

  const { data: landing, error: landingError } = await supabase
    .from('landings')
    .insert({
      slug: parsed.data.slug,
      name: parsed.data.name,
      template_id: parsed.data.template_id,
      status: parsed.data.status,
      advisor_name: parsed.data.advisor_name || null,
      whatsapp_number: parsed.data.whatsapp_number || null,
      whatsapp_message: parsed.data.whatsapp_message || null,
      variables,
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

  const { error: stepError } = await supabase.from('landing_email_steps').insert({
    landing_id: landing.id,
    step_number: 1,
    email_template_id: parsed.data.step1_email_template_id,
    offset_days: 0,
    subject: parsed.data.step1_subject,
    content: parsed.data.step1_content,
  });

  if (stepError) {
    console.error('Error creando landing_email_steps:', stepError);
    return { error: 'La landing se creó, pero falló el paso de email 1. Editala para reintentar.' };
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
