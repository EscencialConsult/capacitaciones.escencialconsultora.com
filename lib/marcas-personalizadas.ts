import { createSupabaseServiceClient } from '@/lib/supabase/server';
import type { MarcaPersonalizada } from '@/lib/landing-template-defaults';

/**
 * Trae todas las marcas creadas desde /admin/marcas, mapeadas al mismo
 * shape (camelCase) que usa armarPromptPlantillaNueva — un solo lugar
 * para esta query en vez de repetirla en templates/new y
 * templates/[id]/edit (2026-08-28).
 */
export async function obtenerMarcasPersonalizadas(): Promise<MarcaPersonalizada[]> {
  const supabase = createSupabaseServiceClient();
  const { data } = await supabase
    .from('marcas_personalizadas')
    .select('id, nombre, colores, degradado, tipografia_principal, tipografias_secundarias, logo_blanco, logo_negro, logo_isotipo')
    .order('nombre');

  return (data ?? []).map((m) => ({
    id: m.id,
    nombre: m.nombre,
    colores: (m.colores as string[] | null) ?? [],
    degradado: m.degradado,
    tipografiaPrincipal: m.tipografia_principal,
    tipografiasSecundarias: (m.tipografias_secundarias as string[] | null) ?? [],
    logoBlanco: m.logo_blanco,
    logoNegro: m.logo_negro,
    logoIsotipo: m.logo_isotipo,
  }));
}
