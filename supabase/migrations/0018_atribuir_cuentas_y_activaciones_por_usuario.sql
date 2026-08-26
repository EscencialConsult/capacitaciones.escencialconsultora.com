-- Base para el sistema de créditos por persona (2026-08-26, pedido
-- explícito de Facundo) — antes de poder armar "cada uno consume sus
-- propios créditos según sus propias cuentas conectadas", hacen falta
-- dos cosas que hoy no existen: (1) saber a qué ADMIN pertenece cada
-- cuenta de Brevo/Resend conectada (hoy son filas globales, compartidas
-- por todo el panel, sin dueño), y (2) saber QUIÉN activó cada campaña
-- (hoy `campaigns` no lo registra en ningún lado). Esta migración es
-- solo esa base — el conteo/consumo de créditos en sí es un paso
-- aparte, todavía sin construir.

-- ── Cuentas de envío, ahora con dueño ──────────────────────────────
-- Nullable a propósito: una cuenta de Brevo/Resend puede en teoría
-- quedar sin dueño (nunca debería pasar en un flujo normal, pero no
-- hay motivo para que la constraint sea más estricta que la realidad
-- todavía sin terminar de migrar). ON DELETE SET NULL en vez de
-- CASCADE — si se borra un usuario del panel, su cuenta de envío
-- conectada no debería desaparecer sola (podría reasignarse a otro
-- admin), solo queda huérfana.
alter table brevo_accounts
  add column user_id uuid references auth.users(id) on delete set null;

alter table resend_accounts
  add column user_id uuid references auth.users(id) on delete set null;

-- Las cuentas que ya existen (conectadas el 25/8) son de
-- areaidautomatizaciones@gmail.com — es quien las cargó desde el
-- panel, confirmado por Facundo. Sin este backfill quedarían sin
-- dueño y nadie podría "usarlas" bajo el modelo por persona.
update brevo_accounts
set user_id = (select id from auth.users where email = 'areaidautomatizaciones@gmail.com')
where user_id is null;

update resend_accounts
set user_id = (select id from auth.users where email = 'areaidautomatizaciones@gmail.com')
where user_id is null;

-- ── Campañas, ahora con quién las activó ───────────────────────────
-- Quedan en null las que ya están activas/pausadas de antes de este
-- cambio (2026-08-26 hacia atrás) — no hay forma honesta de reconstruir
-- retroactivamente quién las activó en su momento, y Facundo ya avisó
-- que el conteo arranca desde ayer (25/8) hacia adelante, no antes.
alter table campaigns
  add column activated_by uuid references auth.users(id) on delete set null;

-- activar_campana ahora recibe quién activa y lo graba en la campaña
-- que efectivamente queda 'active' — no en las que pausa de paso (esas
-- conservan el activated_by que ya tenían, no se tocan). Mismo patrón
-- de lock que la versión anterior (ver 0009), solo se agrega el
-- parámetro y el SET de la columna nueva.
create or replace function activar_campana(p_campaign_id uuid, p_activated_by uuid)
returns void
language plpgsql
as $$
declare
  v_landing_id uuid;
  v_status text;
begin
  select landing_id into v_landing_id
  from campaigns
  where id = p_campaign_id;

  if v_landing_id is null then
    raise exception 'No se encontró la campaña.';
  end if;

  perform 1 from campaigns where landing_id = v_landing_id order by id for update;

  select status into v_status from campaigns where id = p_campaign_id;

  if v_status not in ('draft', 'paused') then
    raise exception 'Solo se puede activar una campaña que esté en borrador o pausada.';
  end if;

  update campaigns
  set status = case when id = p_campaign_id then 'active' else 'paused' end,
      activated_by = case when id = p_campaign_id then p_activated_by else activated_by end,
      updated_at = now()
  where landing_id = v_landing_id
    and (id = p_campaign_id or status = 'active');

  update landings set is_active = true where id = v_landing_id;
end;
$$;

-- Mismo criterio para mover_landing_y_activar — mover una campaña ya
-- activa a otra landing es, en los hechos, una reactivación, así que
-- también registra quién la está moviendo/reactivando.
create or replace function mover_landing_y_activar(p_campaign_id uuid, p_landing_id_nuevo uuid, p_activated_by uuid)
returns void
language plpgsql
as $$
declare
  v_landing_id_origen uuid;
begin
  select landing_id into v_landing_id_origen
  from campaigns
  where id = p_campaign_id;

  if v_landing_id_origen is null then
    raise exception 'No se encontró la campaña a mover.';
  end if;

  perform 1 from campaigns
  where landing_id in (v_landing_id_origen, p_landing_id_nuevo)
  order by landing_id, id
  for update;

  update campaigns
  set status = 'paused', updated_at = now()
  where landing_id = p_landing_id_nuevo
    and status = 'active'
    and id <> p_campaign_id;

  update campaigns
  set landing_id = p_landing_id_nuevo, status = 'active', activated_by = p_activated_by, updated_at = now()
  where id = p_campaign_id;

  update landings set is_active = true where id = p_landing_id_nuevo;
end;
$$;
