'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServiceClient, requireAdmin } from '@/lib/supabase/server';
import { HTML_EMAIL_BASE } from '@/lib/landing-template-defaults';

const schema = z.object({
  name: z.string().trim().min(1, 'Falta el nombre.'),
  html_content: z.string().min(1, 'Falta el HTML.'),
  is_active: z.enum(['true', 'false']),
  // Control de concurrencia optimista (solo se usa en updateEmailTemplate):
  // el updated_at que la plantilla tenía en el momento en que se abrió
  // este formulario (ver email-templates/[id]/edit/page.tsx). Viaja como
  // input hidden — "Nueva plantilla" no lo manda porque ahí no hay nada
  // previo con qué comparar. Mismo patrón que templates/actions.ts.
  expected_updated_at: z.string().trim().optional(),
});

function parse(formData: FormData) {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' } as const;
  return {
    data: { name: parsed.data.name, html_content: parsed.data.html_content, is_active: parsed.data.is_active === 'true' },
    // Aparte de "data" a propósito: no es una columna que se escriba,
    // solo se usa para el chequeo de concurrencia en updateEmailTemplate.
    expectedUpdatedAt: parsed.data.expected_updated_at || null,
  } as const;
}

export async function createEmailTemplate(_prevState: { error?: string } | undefined, formData: FormData) {
  if (!(await requireAdmin())) {
    return { error: 'No autorizado.' };
  }

  const parsed = parse(formData);
  if ('error' in parsed) return { error: parsed.error };

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from('email_templates').insert(parsed.data);
  if (error) {
    console.error('Error creando plantilla de email:', error);
    return { error: 'No se pudo crear la plantilla.' };
  }

  revalidatePath('/admin/email-templates');
  redirect('/admin/email-templates');
}

export async function updateEmailTemplate(
  templateId: string,
  _prevState: { error?: string } | undefined,
  formData: FormData
) {
  if (!(await requireAdmin())) {
    return { error: 'No autorizado.' };
  }

  const parsed = parse(formData);
  if ('error' in parsed) return { error: parsed.error };

  const supabase = createSupabaseServiceClient();

  const { data: actual, error: actualError } = await supabase
    .from('email_templates')
    .select('updated_at')
    .eq('id', templateId)
    .single();

  // Si no pudimos traer el estado actual, no sabemos contra qué comparar
  // — fallamos cerrado (bloqueamos el guardado) en vez de asumir que no
  // hay nada que proteger. Mismo criterio que updateTemplate.
  if (actualError || !actual) {
    console.error('Error leyendo estado actual de la plantilla de email:', actualError);
    return { error: 'No se pudo verificar el estado actual de la plantilla, probá de nuevo.' };
  }

  // Control de concurrencia optimista: si el updated_at que el formulario
  // tenía cargado al abrirse ya no coincide con el que está guardado
  // ahora, alguien más (otro admin, otra pestaña) guardó esta plantilla
  // después de que se abrió este formulario — sin este chequeo, este
  // guardado pisaría en silencio ese cambio ajeno con datos viejos.
  if (parsed.expectedUpdatedAt !== actual.updated_at) {
    return {
      error:
        'Esta plantilla se editó desde otra pestaña después de que abriste esta — recargá (F5) y volvé a aplicar tus cambios.',
    };
  }

  const { error } = await supabase
    .from('email_templates')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', templateId);
  if (error) {
    console.error('Error actualizando plantilla de email:', error);
    return { error: 'No se pudo actualizar la plantilla.' };
  }

  revalidatePath('/admin/email-templates');
  redirect('/admin/email-templates');
}

const schemaInline = z.object({
  name: z.string().trim().min(1, 'Falta el nombre.'),
});

/**
 * Se llama desde el modal de acceso directo en CampaignForm (botón "+
 * Crear diseño" de cada paso de email) — mismo patrón que
 * categories/actions.ts → createCategory: no redirige, devuelve la
 * plantilla creada para que el formulario de campaña la agregue al
 * selector y la deje elegida en ese paso sin perder el resto de lo
 * tipeado. Arranca con el HTML simple de respaldo (HTML_EMAIL_BASE) —
 * Facundo lo edita después desde /admin/email-templates si quiere algo
 * más elaborado, esto es solo para no bloquearlo en el momento.
 */
export async function createEmailTemplateInline(_prevState: { error?: string } | undefined, formData: FormData) {
  if (!(await requireAdmin())) {
    return { error: 'No autorizado.' };
  }

  const parsed = schemaInline.safeParse({ name: formData.get('name') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' };

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from('email_templates')
    .insert({ name: parsed.data.name, html_content: HTML_EMAIL_BASE, is_active: true })
    .select('id, name')
    .single();

  if (error) {
    console.error('Error creando plantilla de email (acceso directo):', error);
    return { error: 'No se pudo crear el diseño.' };
  }

  revalidatePath('/admin/email-templates');
  revalidatePath('/admin/campaigns');
  return { ok: true as const, template: data };
}

export async function toggleEmailTemplateActive(templateId: string, activar: boolean) {
  if (!(await requireAdmin())) {
    return { error: 'No autorizado.' };
  }

  const supabase = createSupabaseServiceClient();
  await supabase.from('email_templates').update({ is_active: activar }).eq('id', templateId);
  revalidatePath('/admin/email-templates');
}
