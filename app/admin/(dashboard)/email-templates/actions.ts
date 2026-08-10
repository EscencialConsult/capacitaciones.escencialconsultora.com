'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

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

export async function toggleEmailTemplateActive(templateId: string, activar: boolean) {
  const supabase = createSupabaseServiceClient();
  await supabase.from('email_templates').update({ is_active: activar }).eq('id', templateId);
  revalidatePath('/admin/email-templates');
}
