-- Vista de "vinculaciones" (2026-09-01, ítem 4 del backlog del 28/8,
-- el único que seguía sin tocar) — cuánto crédito le está consumiendo
-- CADA campaña a su dueño, para mostrarlo en /admin/campaigns (tooltip
-- + ícono que cambia según qué tan cerca está el dueño de agotarse).
--
-- Una sola función que agrupa TODO credit_ledger del ciclo actual de
-- una — así la pantalla de campañas hace UN round-trip en vez de
-- llamar creditos_usados_ciclo_actual-por-campaña (que no existe, esa
-- agrupa por usuario) una vez por fila.
create or replace function creditos_por_campana_ciclo_actual()
returns table(campaign_id uuid, creditos int)
language sql
stable
as $$
  select campaign_id, sum(credits)::int as creditos
  from credit_ledger
  where created_at >= inicio_ciclo_creditos()
  group by campaign_id;
$$;
