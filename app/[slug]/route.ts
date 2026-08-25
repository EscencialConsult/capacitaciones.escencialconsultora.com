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
    .select('id, is_active, is_test, landing_templates(html_content)')
    .eq('slug', params.slug)
    .single();

  if (error) {
    // Esto es un fallo real de la consulta (timeout, RLS mal configurada,
    // columna renombrada), no un simple "no existe" — si no se loguea acá,
    // en producción es indistinguible de un visitante con un link mal
    // tipeado, y un corte de Supabase haría 404ear a TODAS las landings
    // públicas sin dejar rastro en los logs del servidor.
    console.error('[GET /[slug]] Error al consultar landing:', error);
  }

  if (error || !landing || !landing.is_active) {
    return new NextResponse('Landing no encontrada.', { status: 404 });
  }

  const template = landing.landing_templates as unknown as { html_content: string } | null;
  if (!template) {
    return new NextResponse('Esta landing no tiene plantilla asignada.', { status: 500 });
  }

  const { data: campana, error: campanaError } = await supabase
    .from('campaigns')
    .select('variables')
    .eq('landing_id', landing.id)
    .eq('status', 'active')
    .maybeSingle();

  if (campanaError) {
    // Mismo caso que arriba: sin este log, un fallo real de la consulta a
    // `campaigns` se ve igual que "todavía no hay campaña activa".
    console.error('[GET /[slug]] Error al consultar campaña activa:', campanaError);
  }

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
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // force-dynamic evita que Next.js cachee esto en el servidor, pero
      // no le dice nada al NAVEGADOR — sin este header, Chrome puede
      // servir una copia vieja de /slug desde su caché de disco en una
      // visita posterior (hasta en una pestaña nueva), mostrando
      // contenido/variables de antes de la última campaña guardada.
      // Esta página cambia con cada campaña activada/editada, así que
      // nunca puede quedar cacheada en ningún lado.
      'Cache-Control': 'no-store, must-revalidate',
      // Sin esto, una landing marcada is_test (armada solo para mostrarle
      // un diseño a un cliente, no una campaña real) queda tan indexable
      // como cualquier otra — Google la rastrea igual y semanas después
      // puede aparecer en resultados de búsqueda confundiéndose con la
      // landing definitiva del mismo cliente. ver migración
      // 0013_landing_is_test.sql y LandingForm.tsx para dónde se marca.
      ...(landing.is_test ? { 'X-Robots-Tag': 'noindex' } : {}),
    },
  });
}
