'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

// Rango Unicode U+0300-U+036F (diacríticos combinantes que aparecen tras
// normalize('NFD')), armado con codepoints numéricos a propósito — nada
// de tildes/eñes ni escapes \u crudos en el código fuente, es justo la
// clase de bug que ya nos rompió antes en otra parte del proyecto.
const INICIO_DIACRITICOS = 0x0300;
const FIN_DIACRITICOS = 0x036f;
const DIACRITICOS_COMBINANTES = new RegExp(
  '[' + String.fromCodePoint(INICIO_DIACRITICOS) + '-' + String.fromCodePoint(FIN_DIACRITICOS) + ']',
  'g'
);

function slugify(texto: string) {
  return texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICOS_COMBINANTES, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const schema = z.object({
  name: z.string().trim().min(1, 'Falta el nombre.'),
});

/**
 * Se llama desde el modal de TemplateForm — devuelve la categoría creada
 * para que el formulario la agregue al selector al toque, sin recargar
 * la página ni perder lo que ya se había tipeado en el resto del form.
 */
export async function createCategory(_prevState: { error?: string } | undefined, formData: FormData) {
  const parsed = schema.safeParse({ name: formData.get('name') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' };

  const slug = slugify(parsed.data.name);
  if (!slug) return { error: 'Ese nombre no genera un identificador válido, probá con otro.' };

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from('landing_categories')
    .insert({ name: parsed.data.name, slug })
    .select('id, name')
    .single();

  if (error) {
    if (error.code === '23505') return { error: 'Ya existe una categoría con ese nombre.' };
    console.error('Error creando categoría:', error);
    return { error: 'No se pudo crear la categoría.' };
  }

  revalidatePath('/admin/templates/new');
  return { ok: true as const, category: data };
}
