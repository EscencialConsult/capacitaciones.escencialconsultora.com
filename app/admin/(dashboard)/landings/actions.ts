'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { processPendingEmails } from '@/lib/email/process-pending';

// Slugs que nunca pueden ser el link de una landing — colisionan con
// rutas reales de la app (ver app/[slug]/route.ts).
const SLUGS_RESERVADOS = ['admin', 'api'];

const landingSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, 'El link solo puede tener minúsculas, números y guiones.')
    .refine((s) => !SLUGS_RESERVADOS.includes(s), 'Ese link está reservado, elegí otro.'),
  name: z.string().trim().min(1, 'Falta el nombre.'),
  category_id: z.string().uuid().optional().or(z.literal('')),
  template_id: z.string().uuid('Elegí una plantilla.'),
  is_active: z.enum(['true', 'false']),
});

function parseLandingForm(formData: FormData) {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = landingSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' } as const;

  return {
    data: {
      slug: parsed.data.slug,
      name: parsed.data.name,
      category_id: parsed.data.category_id || null,
      template_id: parsed.data.template_id,
      is_active: parsed.data.is_active === 'true',
    },
  } as const;
}

/**
 * La Landing es el link público en sí (slug + plantilla + categoría) —
 * se crea independiente de cualquier campaña. El contenido/asesora/
 * emails se cargan después conectando una campaña (ver
 * campaigns/actions.ts → createCampaign), no acá.
 */
export async function createLanding(_prevState: { error?: string } | undefined, formData: FormData) {
  const parsed = parseLandingForm(formData);
  if ('error' in parsed) return { error: parsed.error };

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from('landings').insert(parsed.data);

  if (error) {
    if (error.code === '23505') return { error: 'Ya existe una landing con ese link.' };
    console.error('Error creando landing:', error);
    return { error: 'No se pudo crear la landing.' };
  }

  revalidatePath('/admin/landings');
  redirect('/admin/landings');
}

export async function updateLanding(
  landingId: string,
  _prevState: { error?: string } | undefined,
  formData: FormData
) {
  const parsed = parseLandingForm(formData);
  if ('error' in parsed) return { error: parsed.error };

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from('landings')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', landingId);

  if (error) {
    if (error.code === '23505') return { error: 'Ya existe otra landing con ese link.' };
    console.error('Error actualizando landing:', error);
    return { error: 'No se pudo actualizar la landing.' };
  }

  revalidatePath('/admin/landings');
  redirect('/admin/landings');
}

/**
 * Nunca se borra en duro — mismo criterio que plantillas/diseños de
 * email: se desactiva (is_active = false), que es lo mismo que usa
 * app/[slug]/route.ts para decidir si esa URL sigue sirviendo o no.
 */
export async function toggleLandingActive(landingId: string, activar: boolean) {
  const supabase = createSupabaseServiceClient();
  await supabase.from('landings').update({ is_active: activar }).eq('id', landingId);
  revalidatePath('/admin/landings');
}

const landingInlineSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, 'El link solo puede tener minúsculas, números y guiones.')
    .refine((s) => !SLUGS_RESERVADOS.includes(s), 'Ese link está reservado, elegí otro.'),
  name: z.string().trim().min(1, 'Falta el nombre.'),
  category_id: z.string().uuid().optional().or(z.literal('')),
  template_id: z.string().uuid('Elegí una plantilla.'),
});

/**
 * Se llama desde el modal "+ Crear landing nueva" de CampaignForm —
 * mismo patrón que createCategory/createEmailTemplateInline: no
 * redirige, devuelve la landing creada (con su plantilla embebida) para
 * que el formulario de campaña la agregue a la lista y la deje elegida
 * sin perder el resto de lo tipeado. Arranca activa por default — si
 * Facundo la crea desde acá es porque la va a usar ya mismo.
 */
export async function createLandingInline(_prevState: { error?: string } | undefined, formData: FormData) {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = landingInlineSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' };

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from('landings')
    .insert({
      slug: parsed.data.slug,
      name: parsed.data.name,
      category_id: parsed.data.category_id || null,
      template_id: parsed.data.template_id,
      is_active: true,
    })
    .select('id, slug, name, template_id, landing_templates(name, variables_schema)')
    .single();

  if (error) {
    if (error.code === '23505') return { error: 'Ya existe una landing con ese link.' };
    console.error('Error creando landing (acceso directo):', error);
    return { error: 'No se pudo crear la landing.' };
  }

  revalidatePath('/admin/landings');
  revalidatePath('/admin/campaigns');
  return { ok: true as const, landing: data };
}

/**
 * Botón manual "Enviar pendientes ahora" — misma lógica que corre el
 * cron cada 1 hora, pero disparada a mano para poder probar sin esperar
 * ni depender de un deploy.
 */
export async function sendPendingNow() {
  const resultado = await processPendingEmails();
  revalidatePath('/admin/landings');
  return resultado;
}
