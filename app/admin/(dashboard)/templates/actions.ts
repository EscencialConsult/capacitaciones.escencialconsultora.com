'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

const templateSchema = z.object({
  name: z.string().trim().min(1, 'Falta el nombre de la plantilla.'),
  category_id: z.string().uuid().optional().or(z.literal('')),
  html_content: z.string().min(1, 'Falta el HTML de la plantilla.'),
  variables_schema_json: z.string().trim().min(1),
  is_active: z.enum(['true', 'false']),
});

function parseTemplateForm(formData: FormData) {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = templateSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' } as const;
  }

  let variables_schema: unknown;
  try {
    variables_schema = JSON.parse(parsed.data.variables_schema_json);
  } catch {
    return { error: 'El JSON de variables no es válido.' } as const;
  }

  return {
    data: {
      name: parsed.data.name,
      category_id: parsed.data.category_id || null,
      html_content: parsed.data.html_content,
      variables_schema,
      is_active: parsed.data.is_active === 'true',
    },
  } as const;
}

export async function createTemplate(_prevState: { error?: string } | undefined, formData: FormData) {
  const parsed = parseTemplateForm(formData);
  if ('error' in parsed) return { error: parsed.error };

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from('landing_templates').insert(parsed.data);

  if (error) {
    console.error('Error creando plantilla:', error);
    return { error: 'No se pudo crear la plantilla.' };
  }

  revalidatePath('/admin/templates');
  redirect('/admin/templates');
}

export async function updateTemplate(
  templateId: string,
  _prevState: { error?: string } | undefined,
  formData: FormData
) {
  const parsed = parseTemplateForm(formData);
  if ('error' in parsed) return { error: parsed.error };

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from('landing_templates')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', templateId);

  if (error) {
    console.error('Error actualizando plantilla:', error);
    return { error: 'No se pudo actualizar la plantilla.' };
  }

  revalidatePath('/admin/templates');
  redirect('/admin/templates');
}

/**
 * Nunca se borra en duro — mismo criterio que el resto del sistema: se
 * desactiva (is_active = false), así una landing que ya la esté usando
 * no queda con una referencia rota.
 */
export async function toggleTemplateActive(templateId: string, activar: boolean) {
  const supabase = createSupabaseServiceClient();
  await supabase.from('landing_templates').update({ is_active: activar }).eq('id', templateId);
  revalidatePath('/admin/templates');
}
