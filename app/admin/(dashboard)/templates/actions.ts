'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { extraerVariablesDeHtml } from '@/lib/landing-template-defaults';

const templateSchema = z.object({
  name: z.string().trim().min(1, 'Falta el nombre de la plantilla.'),
  category_id: z.string().uuid().optional().or(z.literal('')),
  html_content: z.string().min(1, 'Falta el HTML de la plantilla.'),
  is_active: z.enum(['true', 'false']),
});

/**
 * Las variables NO se tipean a mano en ningún campo — se detectan solas
 * a partir de cada {{clave}} que aparezca en el HTML pegado (ver
 * extraerVariablesDeHtml). Así una plantilla nueva con {{precio_plan_1}}
 * o cualquier variable propia queda disponible en el formulario de
 * campaña sin tocar código ni mostrar una interfaz de JSON en el panel.
 */
function parseTemplateForm(formData: FormData) {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = templateSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' } as const;
  }

  return {
    data: {
      name: parsed.data.name,
      category_id: parsed.data.category_id || null,
      html_content: parsed.data.html_content,
      variables_schema: extraerVariablesDeHtml(parsed.data.html_content),
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
