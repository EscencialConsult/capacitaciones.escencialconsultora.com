'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { HTML_EMAIL_BASE } from '@/lib/landing-template-defaults';

const schema = z.object({
  name: z.string().trim().min(1, 'Falta el nombre.'),
  html_content: z.string().min(1, 'Falta el HTML.'),
  is_active: z.enum(['true', 'false']),
});

function parse(formData: FormData) {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' } as const;
  return {
    data: { name: parsed.data.name, html_content: parsed.data.html_content, is_active: parsed.data.is_active === 'true' },
  } as const;
}

export async function createEmailTemplate(_prevState: { error?: string } | undefined, formData: FormData) {
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
  const parsed = parse(formData);
  if ('error' in parsed) return { error: parsed.error };

  const supabase = createSupabaseServiceClient();
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
  const supabase = createSupabaseServiceClient();
  await supabase.from('email_templates').update({ is_active: activar }).eq('id', templateId);
  revalidatePath('/admin/email-templates');
}
