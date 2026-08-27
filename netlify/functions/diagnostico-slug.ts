import { createClient } from '@supabase/supabase-js';

/**
 * Diagnóstico temporal (2026-08-27) — /claudeago26 da 404 "sin campaña
 * activa" en producción, pero la MISMA consulta corrida a mano (fuera
 * de Netlify) encuentra todo bien. Esto repite la consulta exacta de
 * app/[slug]/route.ts pero DESDE el runtime real de Netlify, para
 * aislar si el problema es específico de ese entorno. Borrar una vez
 * resuelto.
 */
export default async () => {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: landing, error: e1 } = await supabase
    .from('landings')
    .select('id, is_active, is_test, landing_templates(html_content)')
    .eq('slug', 'claudeago26')
    .single();

  const resultado: Record<string, unknown> = {
    landing_encontrada: !!landing,
    landing_id: landing?.id,
    landing_is_active: landing?.is_active,
    error_landing: e1?.message ?? null,
  };

  if (landing) {
    const { data: campana, error: e2 } = await supabase
      .from('campaigns')
      .select('variables')
      .eq('landing_id', landing.id)
      .eq('status', 'active')
      .maybeSingle();

    resultado.campana_encontrada = !!campana;
    resultado.error_campana = e2?.message ?? null;
    resultado.error_campana_completo = e2 ? JSON.stringify(e2) : null;
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  await admin.from('system_alerts').upsert(
    { source: 'diagnostico_slug', message: JSON.stringify(resultado), last_seen_at: new Date().toISOString(), resolved_at: null },
    { onConflict: 'source' }
  );
};
