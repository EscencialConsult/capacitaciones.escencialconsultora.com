'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServiceClient, requireAdmin } from '@/lib/supabase/server';
import {
  extraerVariablesDeHtml,
  combinarVariables,
  type DescripcionVariable,
} from '@/lib/landing-template-defaults';

const MARCAS_FIJAS = ['one', 'escencial-latam', 'escencial-argentina', 'esseleccion'] as const;

const templateSchema = z.object({
  name: z.string().trim().min(1, 'Falta el nombre de la plantilla.'),
  // Marca — codificada en un solo campo desde el <select> de
  // TemplateForm.tsx (2026-08-28, pedido explícito: "no debe permitir
  // cargar la plantilla si no se ha colocado la marca"): 'none' = sin
  // marca fija a propósito (elección explícita, sigue siendo un caso
  // válido — estilo 100% libre, ver armarPromptPlantillaNueva), un slug
  // de MARCAS_FIJAS = una de las 4 marcas fijas del sistema, o
  // "custom:<uuid>" = una marca creada desde /admin/marcas. Vacío ya NO
  // es una opción válida — el <select> tiene un placeholder disabled
  // para forzar una elección real, y este .min(1) es el respaldo del
  // lado del servidor si alguien lo saltea (ej. un POST directo).
  marca: z.string().trim().min(1, 'Elegí una marca (o "Sin marca fija" si el diseño es libre).'),
  html_content: z.string().min(1, 'Falta el HTML de la plantilla.'),
  is_active: z.enum(['true', 'false']),
  // Bloque B del prompt de plantilla (opcional) — label + descripción
  // de cada variable, para que el prompt de campaña sepa qué va en
  // cada campo y no solo el nombre de la clave. Ver armarPromptPlantillaNueva.
  variables_meta: z.string().trim().optional().default(''),
  // Checkbox sin marcar no manda nada en el FormData — por eso
  // .optional() en vez de un enum, y se interpreta "vino" = true más
  // abajo. Ver TemplateForm.tsx para el porqué de no usar "disabled".
  envio_personalizado: z.literal('true').optional(),
  // Control de concurrencia optimista (solo se usa en updateTemplate):
  // el updated_at que la plantilla tenía en el momento en que se abrió
  // este formulario (ver templates/[id]/edit/page.tsx). Viaja como
  // input hidden — "Nueva plantilla" no lo manda porque ahí no hay
  // nada previo con qué comparar.
  expected_updated_at: z.string().trim().optional(),
});

/**
 * Las variables NO se tipean a mano campo por campo — se detectan solas
 * a partir de cada {{clave}} que aparezca en el HTML pegado (ver
 * extraerVariablesDeHtml). El JSON opcional de variables_meta solo
 * mejora el label y agrega la descripción de cada una ya detectada,
 * nunca agrega ni saca variables por su cuenta — la única fuente de
 * verdad de QUÉ variables existen es el HTML.
 */
/**
 * Decodifica el valor único del <select> de marca — ver el comentario
 * de templateSchema.marca arriba para el formato de cada caso.
 */
function parseMarca(
  raw: string
): { marca: string | null; marca_personalizada_id: string | null } | { error: string } {
  if (raw === 'none') return { marca: null, marca_personalizada_id: null };
  if (raw.startsWith('custom:')) {
    const id = raw.slice('custom:'.length);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return { error: 'Marca inválida.' };
    }
    return { marca: null, marca_personalizada_id: id };
  }
  if ((MARCAS_FIJAS as readonly string[]).includes(raw)) {
    return { marca: raw, marca_personalizada_id: null };
  }
  return { error: 'Marca inválida.' };
}

function parseTemplateForm(formData: FormData) {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = templateSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' } as const;
  }

  const marcaResuelta = parseMarca(parsed.data.marca);
  if ('error' in marcaResuelta) return { error: marcaResuelta.error } as const;

  let descripciones: Record<string, DescripcionVariable> | undefined;
  if (parsed.data.variables_meta) {
    try {
      const json = JSON.parse(parsed.data.variables_meta);
      if (typeof json !== 'object' || json === null || Array.isArray(json)) throw new Error();
      descripciones = json;
    } catch {
      return {
        error:
          'El JSON de "Descripciones de variables" no es válido — tiene que ser un objeto {"clave": {"label": "...", "descripcion": "..."}}.',
      } as const;
    }
  }

  const detectadas = extraerVariablesDeHtml(parsed.data.html_content);

  return {
    data: {
      name: parsed.data.name,
      marca: marcaResuelta.marca,
      marca_personalizada_id: marcaResuelta.marca_personalizada_id,
      html_content: parsed.data.html_content,
      variables_schema: combinarVariables(detectadas, descripciones),
      is_active: parsed.data.is_active === 'true',
      envio_personalizado: parsed.data.envio_personalizado === 'true',
    },
    // Aparte de "data" a propósito: no es una columna que se escriba,
    // solo se usa para el chequeo de concurrencia en updateTemplate.
    expectedUpdatedAt: parsed.data.expected_updated_at || null,
  } as const;
}

export async function createTemplate(_prevState: { error?: string } | undefined, formData: FormData) {
  if (!(await requireAdmin())) {
    return { error: 'No autorizado.' };
  }

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

/**
 * Cuántas campañas dependen de esta plantilla, contando a través de las
 * landings que la usan (plantilla → landings → campaigns). Se usa para
 * bloquear la edición del HTML — ver el comentario en updateTemplate.
 * Query en dos pasos en vez de un join porque supabase-js filtrar por
 * columna de una tabla relacionada (landings.template_id) en un select
 * sobre campaigns es más frágil que dos queries simples.
 */
export async function contarCampanasConectadas(templateId: string): Promise<number> {
  if (!(await requireAdmin())) return 0;

  const supabase = createSupabaseServiceClient();

  const { data: landings } = await supabase
    .from('landings')
    .select('id')
    .eq('template_id', templateId);
  const landingIds = (landings ?? []).map((l) => l.id);
  if (landingIds.length === 0) return 0;

  const { count } = await supabase
    .from('campaigns')
    .select('id', { count: 'exact', head: true })
    .in('landing_id', landingIds);

  return count ?? 0;
}

/**
 * El HTML de una plantilla no se puede tocar una vez que hay alguna
 * campaña conectada (a través de sus landings) — Facundo se encontró
 * con esto en carne propia: editó el diseño, los nombres de {{clave}}
 * cambiaron, y las campañas que ya tenían contenido cargado con las
 * claves viejas quedaron con esos datos huérfanos (la campaña mostraba
 * los campos nuevos vacíos, no los viejos). Nombre/marca/estado y las
 * descripciones de variables sí se pueden seguir editando siempre —
 * no tocan qué {{clave}} existen, no rompen nada. Si hace falta un
 * diseño distinto para una plantilla ya en uso, la respuesta es crear
 * una plantilla nueva, no editar esta.
 */
export async function updateTemplate(
  templateId: string,
  _prevState: { error?: string } | undefined,
  formData: FormData
) {
  if (!(await requireAdmin())) {
    return { error: 'No autorizado.' };
  }

  const parsed = parseTemplateForm(formData);
  if ('error' in parsed) return { error: parsed.error };

  const supabase = createSupabaseServiceClient();

  const { data: actual, error: actualError } = await supabase
    .from('landing_templates')
    .select('html_content, envio_personalizado, updated_at')
    .eq('id', templateId)
    .single();

  // Si no pudimos traer el estado actual, no sabemos si hay HTML o
  // envio_personalizado que proteger — fallamos cerrado (bloqueamos el
  // guardado) en vez de asumir que no hay nada que proteger. Lo contrario
  // saltea en silencio las dos protecciones de abajo.
  if (actualError || !actual) {
    console.error('Error leyendo estado actual de la plantilla:', actualError);
    return { error: 'No se pudo verificar el estado actual de la plantilla, probá de nuevo.' };
  }

  // Control de concurrencia optimista: si el updated_at que el
  // formulario tenía cargado al abrirse ya no coincide con el que está
  // guardado ahora, alguien más (otro admin, otra pestaña) guardó esta
  // plantilla después de que se abrió este formulario — sin este
  // chequeo, este guardado pisaría en silencio ese cambio ajeno con
  // datos viejos. Mismo criterio de "fallar cerrado" que el bloque de
  // arriba: si por lo que sea no vino el valor esperado, se bloquea
  // igual en vez de asumir que no hay nada con qué comparar.
  if (parsed.expectedUpdatedAt !== actual.updated_at) {
    return {
      error:
        'Esta plantilla se editó desde otra pestaña después de que abriste esta — recargá (F5) y volvé a aplicar tus cambios.',
    };
  }

  const campanasConectadas = await contarCampanasConectadas(templateId);

  if (actual.html_content !== parsed.data.html_content && campanasConectadas > 0) {
    return {
      error: `Esta plantilla tiene ${campanasConectadas} campaña${campanasConectadas === 1 ? '' : 's'} conectada${campanasConectadas === 1 ? '' : 's'} — no se puede cambiar el HTML sin arriesgar romper su contenido cargado (los nombres de variable pueden cambiar). Creá una plantilla nueva si necesitás otro diseño. El nombre, la marca, el estado y las descripciones de variables sí se pueden guardar.`,
    };
  }

  // El checkbox "Envío personalizado" del cliente queda inerte cuando
  // hay campañas conectadas (ver TemplateForm.tsx), pero eso es solo
  // UX — la protección real es acá: si hay campañas conectadas, se
  // ignora lo que haya venido en el formulario y se conserva el valor
  // que ya estaba guardado. Mismo criterio que html_content de arriba:
  // cambiar este flag cambia qué campos tiene que mandar el formulario
  // público de la landing, así que es tan riesgoso como cambiar el
  // HTML en sí para una plantilla ya en uso.
  const datosAGuardar = {
    ...parsed.data,
    envio_personalizado:
      campanasConectadas > 0 ? actual.envio_personalizado : parsed.data.envio_personalizado,
  };

  const { error } = await supabase
    .from('landing_templates')
    .update({ ...datosAGuardar, updated_at: new Date().toISOString() })
    .eq('id', templateId);

  if (error) {
    console.error('Error actualizando plantilla:', error);
    return { error: 'No se pudo actualizar la plantilla.' };
  }

  revalidatePath('/admin/templates');
  redirect('/admin/templates');
}

/**
 * Desactivar (is_active = false) es la opción de siempre para sacar una
 * plantilla de circulación sin perder nada — así una landing que ya la
 * esté usando no queda con una referencia rota. deleteTemplate (abajo)
 * es la opción real de borrado, para cuando ya no hace falta ni el
 * registro.
 *
 * Si alguna landing la tiene asignada, bloqueamos la desactivación —
 * mismo criterio que updateTemplate usa para proteger el HTML. Una
 * plantilla inactiva desaparece del <select> de landings/LandingForm.tsx
 * (landings/[id]/edit/page.tsx solo trae plantillas activas), así que
 * desactivarla mientras sigue en uso arriesga que esa landing cambie de
 * plantilla en silencio la próxima vez que se guarde sin tocar ese combo.
 */
export async function toggleTemplateActive(templateId: string, activar: boolean) {
  if (!(await requireAdmin())) {
    return { error: 'No autorizado.' };
  }

  const supabase = createSupabaseServiceClient();

  if (!activar) {
    const { count } = await supabase
      .from('landings')
      .select('id', { count: 'exact', head: true })
      .eq('template_id', templateId);

    if ((count ?? 0) > 0) {
      return {
        error: `Esta plantilla la está usando ${count} landing${count === 1 ? '' : 's'} — no se puede desactivar sin arriesgar que esa landing cambie de plantilla en silencio. Pasá primero esa landing a otra plantilla, o eliminala.`,
      };
    }
  }

  await supabase.from('landing_templates').update({ is_active: activar }).eq('id', templateId);
  revalidatePath('/admin/templates');
}

/**
 * Borrado real (2026-08-14) — protegido por la base, no por acá: la FK
 * landings.template_id no tiene "on delete cascade" (ver
 * supabase/migrations/0001_init.sql), así que si alguna landing sigue
 * usando esta plantilla Postgres rechaza el delete con 23503 en vez de
 * dejar esa landing sin plantilla. La UI (DeleteButton) ya pide
 * confirmación aparte antes de llamar esto — acá no hace falta pedirla
 * de nuevo.
 */
export async function deleteTemplate(templateId: string) {
  if (!(await requireAdmin())) {
    return { error: 'No autorizado.' };
  }

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from('landing_templates').delete().eq('id', templateId);

  if (error) {
    if (error.code === '23503') {
      return { error: 'No se puede eliminar: tiene una o más landings conectadas. Eliminá o desconectá esas landings primero.' };
    }
    console.error('Error eliminando plantilla:', error);
    return { error: 'No se pudo eliminar la plantilla.' };
  }

  revalidatePath('/admin/templates');
}
