import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { replacePlaceholders } from '@/lib/templates';

/**
 * Landing pública. `/{slug}` busca la landing (el link + plantilla en
 * sí, `is_active`), busca su campaña actualmente activa (el contenido:
 * `campaigns.variables`), y arma el HTML final reemplazando los
 * placeholders editables más el placeholder reservado
 * {{__landing_id__}} que necesita el <form> para saber a qué landing
 * pertenece el POST. Landing y Campaña son entidades separadas (ver
 * supabase/migrations/0004_separar_campanas_de_landings.sql) — una
 * landing puede existir sin ninguna campaña activa conectada, en cuyo
 * caso todavía no hay contenido para mostrar y esto 404ea.
 *
 * {{__landing_id__}} sigue resolviendo al id de la LANDING, no de la
 * campaña — a propósito, así ninguna plantilla HTML ya creada necesita
 * volver a subirse (el <form> público sigue mandando landing_id, ver
 * app/api/leads/route.ts).
 *
 * Rutas reservadas que NUNCA pueden ser un slug de landing: 'admin',
 * 'api' — Next.js ya las prioriza por estructura de carpetas, pero la
 * validación en app/admin/landings/actions.ts impide crear una landing
 * con esos slugs para que no haya ambigüedad al leer el código.
 *
 * force-dynamic es obligatorio acá: sin esto, un GET handler se trata
 * como estático y Next.js cachea la respuesta (incluido un 404) para
 * siempre, sin volver a consultar la base — una landing recién activada
 * quedaría devolviendo el 404 viejo de cuando todavía era un borrador.
 */
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  const supabase = createSupabaseServiceClient();

  const { data: landing, error } = await supabase
    .from('landings')
    .select('id, is_active, landing_templates(html_content)')
    .eq('slug', params.slug)
    .single();

  if (error || !landing || !landing.is_active) {
    return new NextResponse('Landing no encontrada.', { status: 404 });
  }

  const template = landing.landing_templates as unknown as { html_content: string } | null;
  if (!template) {
    return new NextResponse('Esta landing no tiene plantilla asignada.', { status: 500 });
  }

  const { data: campana } = await supabase
    .from('campaigns')
    .select('variables')
    .eq('landing_id', landing.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!campana) {
    return new NextResponse('Esta landing todavía no tiene ninguna campaña activa conectada.', {
      status: 404,
    });
  }

  const variables = (campana.variables as Record<string, string>) ?? {};
  const html = replacePlaceholders(template.html_content, {
    ...variables,
    __landing_id__: landing.id,
  });

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
