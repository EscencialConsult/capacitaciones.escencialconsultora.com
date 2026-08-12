import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { replacePlaceholders } from '@/lib/templates';

/**
 * Landing pública. `/{slug}` busca la landing, trae su plantilla, y
 * arma el HTML final reemplazando los placeholders editables
 * (landings.variables) más el placeholder reservado {{__landing_id__}}
 * que necesita el <form> para saber a qué landing pertenece el POST.
 *
 * Rutas reservadas que NUNCA pueden ser un slug de landing: 'admin',
 * 'api' — Next.js ya las prioriza por estructura de carpetas, pero la
 * validación en app/admin/campaigns/actions.ts impide crear una campaña
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
    .select('id, status, variables, landing_templates(html_content)')
    .eq('slug', params.slug)
    .single();

  if (error || !landing || landing.status !== 'active') {
    return new NextResponse('Landing no encontrada.', { status: 404 });
  }

  const template = landing.landing_templates as unknown as { html_content: string } | null;
  if (!template) {
    return new NextResponse('Esta landing no tiene plantilla asignada.', { status: 500 });
  }

  const variables = (landing.variables as Record<string, string>) ?? {};
  const html = replacePlaceholders(template.html_content, {
    ...variables,
    __landing_id__: landing.id,
  });

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
