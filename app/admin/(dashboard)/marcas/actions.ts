'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServiceClient, requireAdmin } from '@/lib/supabase/server';

// Bucket público (2026-08-28) — los logos se embeben directo en HTML de
// landings públicas (sin sesión, sin auth), igual que los de MARCAS
// hardcodeada en /public/logos/ — tienen que poder cargar como
// <img src="..."> normal, sin URL firmada. Creado una sola vez fuera
// de las migraciones SQL (Storage no vive en el esquema de Postgres) —
// ver el script de setup corrido aparte.
const BUCKET = 'marca-logos';
const TAMANO_MAXIMO_LOGO = 2 * 1024 * 1024; // 2MB — de sobra para un logo, ver InputLogo en MarcaForm.tsx

const marcaSchema = z.object({
  nombre: z.string().trim().min(1, 'Falta el nombre de la marca.'),
  // Lista de colores hex separados por coma, armada del lado del
  // cliente a partir de los chips que se van agregando (ver
  // MarcaForm.tsx) — mismo truco que variables_meta en TemplateForm.tsx:
  // un solo input hidden en vez de N campos sueltos.
  colores: z.string().trim().min(1, 'Agregá al menos un color.'),
  degradado: z.string().trim().optional().default(''),
  tipografia_principal: z.string().trim().min(1, 'Falta la tipografía principal.'),
  tipografias_secundarias: z.string().trim().optional().default(''),
});

function extraerLista(raw: string): string[] {
  return raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

type ResultadoSubida = { url: string } | { error: string };

/**
 * Sube un logo al bucket y devuelve su URL pública. `carpeta` es el id
 * (nuevo, generado antes del insert) de la marca — así los 3 logos de
 * una misma marca quedan agrupados y nunca chocan con los de otra.
 */
async function subirLogo(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  file: File | null,
  carpeta: string,
  nombreArchivo: 'blanco' | 'negro' | 'isotipo'
): Promise<ResultadoSubida> {
  if (!file || file.size === 0) {
    return { error: `Falta subir el logo "${nombreArchivo}".` };
  }
  if (!file.type.startsWith('image/')) {
    return { error: `El logo "${nombreArchivo}" tiene que ser una imagen.` };
  }
  if (file.size > TAMANO_MAXIMO_LOGO) {
    return { error: `El logo "${nombreArchivo}" pesa más de 2MB — subí una versión más liviana.` };
  }

  const extension = file.name.split('.').pop() || 'png';
  const ruta = `${carpeta}/${nombreArchivo}.${extension}`;

  const { error } = await supabase.storage.from(BUCKET).upload(ruta, file, {
    contentType: file.type,
    upsert: true,
  });

  if (error) {
    console.error(`Error subiendo logo ${nombreArchivo}:`, error);
    return { error: `No se pudo subir el logo "${nombreArchivo}".` };
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(ruta);
  return { url: data.publicUrl };
}

/**
 * Kit de marca editable (2026-08-28, pedido explícito) — crea una marca
 * propia (colores + tipografía + los mismos 3 logos que ya tiene cada
 * marca fija de MARCAS: fondo oscuro, fondo claro, ícono solo) sin
 * tocar código. Queda disponible al toque en el selector de "Marca" de
 * /admin/templates/new, conectada al mismo prompt automático que ya
 * arman las 4 marcas fijas — ver armarPromptPlantillaNueva
 * (lib/landing-template-defaults.ts).
 */
export async function crearMarcaPersonalizada(
  _prevState: { error?: string } | undefined,
  formData: FormData
) {
  const admin = await requireAdmin();
  if (!admin) {
    return { error: 'No autorizado.' };
  }

  const raw = Object.fromEntries(
    Array.from(formData.entries()).filter(([, v]) => typeof v === 'string')
  ) as Record<string, string>;
  const parsed = marcaSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' };
  }

  const supabase = createSupabaseServiceClient();
  // El id se genera ACÁ (no lo asigna el insert) porque hace falta antes
  // de subir los logos, para poder agruparlos en su propia carpeta del
  // bucket — insertar primero y subir después dejaría una fila a medio
  // crear si la subida fallara.
  const id = randomUUID();

  const [resBlanco, resNegro, resIsotipo] = await Promise.all([
    subirLogo(supabase, formData.get('logo_blanco') as File | null, id, 'blanco'),
    subirLogo(supabase, formData.get('logo_negro') as File | null, id, 'negro'),
    subirLogo(supabase, formData.get('logo_isotipo') as File | null, id, 'isotipo'),
  ]);

  if ('error' in resBlanco) return { error: resBlanco.error };
  if ('error' in resNegro) return { error: resNegro.error };
  if ('error' in resIsotipo) return { error: resIsotipo.error };

  const { error } = await supabase.from('marcas_personalizadas').insert({
    id,
    nombre: parsed.data.nombre,
    colores: extraerLista(parsed.data.colores),
    degradado: parsed.data.degradado || null,
    tipografia_principal: parsed.data.tipografia_principal,
    tipografias_secundarias: extraerLista(parsed.data.tipografias_secundarias),
    logo_blanco: resBlanco.url,
    logo_negro: resNegro.url,
    logo_isotipo: resIsotipo.url,
    created_by: admin.id,
  });

  if (error) {
    console.error('Error creando marca personalizada:', error);
    return { error: 'No se pudo crear la marca — los logos ya se subieron, pero no se guardó el registro. Probá de nuevo.' };
  }

  revalidatePath('/admin/marcas');
  redirect('/admin/marcas');
}

/**
 * Igual que deleteTemplate/deleteCampaign — protegido por la base: la FK
 * landing_templates.marca_personalizada_id no tiene cascada (ver
 * migración 0024), así que una marca en uso por alguna plantilla
 * rechaza el delete con 23503 en vez de dejar esa plantilla con una
 * referencia rota. No borra los archivos del bucket (quedan huérfanos
 * ahí, sin romper nada — Storage no tiene FK con la tabla).
 */
export async function eliminarMarcaPersonalizada(marcaId: string) {
  if (!(await requireAdmin())) {
    return { error: 'No autorizado.' };
  }

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from('marcas_personalizadas').delete().eq('id', marcaId);

  if (error) {
    if (error.code === '23503') {
      return {
        error: 'No se puede eliminar: hay una o más plantillas usando esta marca. Cambiales la marca primero.',
      };
    }
    console.error('Error eliminando marca personalizada:', error);
    return { error: 'No se pudo eliminar la marca.' };
  }

  revalidatePath('/admin/marcas');
}
