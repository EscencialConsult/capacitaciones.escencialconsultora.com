'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServiceClient, requireAdmin } from '@/lib/supabase/server';
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
  template_id: z.string().uuid('Elegí una plantilla.'),
  is_active: z.enum(['true', 'false']),
  // Checkbox: si no está tildado, el campo ni siquiera viaja en el
  // FormData (por eso .optional() en vez de un enum como is_active).
  is_test: z.literal('true').optional(),
});

function parseLandingForm(formData: FormData) {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = landingSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' } as const;

  return {
    data: {
      slug: parsed.data.slug,
      name: parsed.data.name,
      template_id: parsed.data.template_id,
      is_active: parsed.data.is_active === 'true',
      is_test: parsed.data.is_test === 'true',
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
  if (!(await requireAdmin())) {
    return { error: 'No autorizado.' };
  }

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

/**
 * Cuántas campañas están conectadas directo a esta landing — se usa para
 * bloquear el cambio de plantilla en updateLanding, ver el comentario
 * ahí. Mismo criterio que contarCampanasConectadas en
 * templates/actions.ts, pero acá es un solo paso (landing_id directo, no
 * hace falta pasar por landings→campaigns).
 */
async function contarCampanasConectadasALanding(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  landingId: string
): Promise<number> {
  const { count } = await supabase
    .from('campaigns')
    .select('id', { count: 'exact', head: true })
    .eq('landing_id', landingId);

  return count ?? 0;
}

export async function updateLanding(
  landingId: string,
  _prevState: { error?: string } | undefined,
  formData: FormData
) {
  if (!(await requireAdmin())) {
    return { error: 'No autorizado.' };
  }

  const parsed = parseLandingForm(formData);
  if ('error' in parsed) return { error: parsed.error };

  const supabase = createSupabaseServiceClient();

  // Bug real confirmado (2026-08-24) — cambiar la plantilla de una
  // landing que ya tiene campañas conectadas deja el contenido de esas
  // campañas (cargado contra las {{clave}} de la plantilla VIEJA)
  // huérfano: la landing pasa a servir el HTML nuevo, pero
  // campaign.variables sigue teniendo las claves de antes, así que todo
  // lo que no coincide por nombre queda como '{{clave}}' literal en la
  // página pública, EN VIVO, sin que updateCampaign se dispare para
  // avisar (esa validación solo corre si se guarda la campaña, no
  // cuando se edita la landing). Mismo criterio que ya usa updateTemplate
  // para bloquear el cambio de HTML de una plantilla en uso — acá el
  // bloqueo es sobre el template_id de la landing.
  const { data: actual, error: actualError } = await supabase
    .from('landings')
    .select('template_id')
    .eq('id', landingId)
    .single();

  // Si no pudimos traer el template_id actual, no sabemos si hay que
  // proteger nada — fallamos cerrado (bloqueamos el guardado) en vez de
  // asumir que no hay campañas conectadas.
  if (actualError || !actual) {
    console.error('Error leyendo estado actual de la landing:', actualError);
    return { error: 'No se pudo verificar el estado actual de la landing, probá de nuevo.' };
  }

  if (actual.template_id !== parsed.data.template_id) {
    const campanasConectadas = await contarCampanasConectadasALanding(supabase, landingId);
    if (campanasConectadas > 0) {
      return {
        error: `Esta landing tiene ${campanasConectadas} campaña${campanasConectadas === 1 ? '' : 's'} conectada${campanasConectadas === 1 ? '' : 's'} — no se puede cambiar la plantilla sin arriesgar romper su contenido cargado (los nombres de variable pueden cambiar). Desconectá esas campañas primero, o creá una landing nueva si necesitás otro diseño.`,
      };
    }
  }

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
 * Desactivar (is_active = false) es la opción de siempre para sacar una
 * landing de circulación sin perder nada — mismo criterio que
 * plantillas/diseños de email, es lo mismo que usa app/[slug]/route.ts
 * para decidir si esa URL sigue sirviendo o no. deleteLanding (abajo)
 * es la opción real de borrado, para cuando ya no hace falta ni el
 * registro.
 */
export async function toggleLandingActive(
  landingId: string,
  activar: boolean
): Promise<{ error?: string } | void> {
  if (!(await requireAdmin())) {
    return { error: 'No autorizado.' };
  }

  const supabase = createSupabaseServiceClient();
  await supabase.from('landings').update({ is_active: activar }).eq('id', landingId);
  revalidatePath('/admin/landings');
}

/**
 * Borrado real (2026-08-14) — protegido por la base, no por acá: la FK
 * campaigns.landing_id no tiene "on delete cascade" (ver
 * supabase/migrations/0004_separar_campanas_de_landings.sql), así que
 * si esta landing tiene alguna campaña conectada (activa, pausada o
 * incluso en borrador) Postgres rechaza el delete con 23503 en vez de
 * dejar campañas huérfanas apuntando a un landing_id que ya no existe.
 * La UI (DeleteButton) ya pide confirmación aparte antes de llamar
 * esto — acá no hace falta pedirla de nuevo.
 */
export async function deleteLanding(landingId: string) {
  if (!(await requireAdmin())) {
    return { error: 'No autorizado.' };
  }

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from('landings').delete().eq('id', landingId);

  if (error) {
    if (error.code === '23503') {
      return { error: 'No se puede eliminar: tiene una o más campañas conectadas. Eliminá o desconectá esas campañas primero.' };
    }
    console.error('Error eliminando landing:', error);
    return { error: 'No se pudo eliminar la landing.' };
  }

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
  if (!(await requireAdmin())) {
    return { error: 'No autorizado.' };
  }

  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = landingInlineSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' };

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from('landings')
    .insert({
      slug: parsed.data.slug,
      name: parsed.data.name,
      template_id: parsed.data.template_id,
      is_active: true,
    })
    .select('id, slug, name, template_id, landing_templates(name, variables_schema, envio_personalizado)')
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
  if (!(await requireAdmin())) {
    return { error: 'No autorizado.' };
  }

  const resultado = await processPendingEmails();
  revalidatePath('/admin/landings');
  return resultado;
}
