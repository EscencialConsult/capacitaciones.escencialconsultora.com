-- Marcar leads vendidos (2026-08-31, pedido explícito: "hay que ver
-- cómo hacer para marcar los vendidos así no se le siga enviando los
-- emails de las campañas") — hoy un lead recibe TODO el goteo agendado
-- aunque ya haya comprado, porque no hay ningún dato que lo distinga.
-- Esto agrega esa marca + la cancelación real de lo que todavía no se
-- mandó, de dos formas (misma marca, dos caminos para llegar a ella):
--   1. Manual, un lead a la vez, desde la tabla de leads.
--   2. En lote, resubiendo el mismo tipo de export del CRM y matcheando
--      por email contra los leads ya cargados (ver MarcarVendidosButton.tsx).

alter table leads add column vendido_at timestamptz;

-- Camino 1: manual, un lead puntual (se tiene el id de la fila en la
-- tabla, tenga o no email cargado — a diferencia del camino por email,
-- este también sirve para un lead cargado solo con teléfono).
create or replace function marcar_lead_vendido(p_lead_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_ya_estaba boolean;
begin
  select vendido_at is not null into v_ya_estaba from leads where id = p_lead_id;

  if v_ya_estaba is null then
    return jsonb_build_object('error', 'no_existe');
  end if;

  update leads set vendido_at = now() where id = p_lead_id and vendido_at is null;

  -- Solo lo que todavía no se mandó — un email ya enviado no se puede
  -- "desenviar", y uno en 'processing' ya está a mitad de camino en el
  -- proveedor (ver MINUTOS_PROCESSING_HUERFANO en process-pending.ts).
  update email_sends set status = 'skipped' where lead_id = p_lead_id and status = 'pending';

  return jsonb_build_object('ok', true, 'ya_estaba', v_ya_estaba);
end;
$$;

-- Camino 2: en lote, por email, acotado a UNA campaña (misma lógica
-- que "Cargar leads" — el admin lo hace desde la pantalla de esa
-- campaña puntual, no busca en toda la plataforma). Un solo round-trip
-- a la base para todo el lote, no uno por fila.
create or replace function marcar_vendidos_por_email(p_campaign_id uuid, p_emails text[])
returns jsonb
language plpgsql
as $$
declare
  v_ids uuid[];
  v_marcados int;
  v_encontrados int;
begin
  select array_agg(id) into v_ids
  from leads
  where campaign_id = p_campaign_id
    and email is not null
    and lower(email) = any(p_emails);

  v_encontrados := coalesce(array_length(v_ids, 1), 0);

  with recien as (
    update leads set vendido_at = now()
    where id = any(v_ids) and vendido_at is null
    returning id
  )
  select count(*) into v_marcados from recien;

  update email_sends
  set status = 'skipped'
  where status = 'pending' and lead_id = any(v_ids);

  return jsonb_build_object('marcados', v_marcados, 'encontrados', v_encontrados);
end;
$$;
