-- Restablecer una venta confirmada/rechazada por error (2026-09-01,
-- pedido explícito: "ver los leads que se rechazaron, los que se
-- aprobaron... y si se puede restablecer y cambiar la situación de un
-- lead que se haya rechazado, aprobado, también cambiarlo") — hasta
-- ahora confirmar/rechazar era definitivo, sin vuelta atrás desde la
-- pantalla.
--
-- Ojo con el límite real: si esta venta había marcado vendido a un
-- lead (vendido_at) y por eso se le cancelaron emails pendientes
-- ('skipped'), restablecer la venta NO reactiva esos emails — no hay
-- forma honesta de saber si "deberían" haberse mandado en su momento
-- original. Sí se le quita la marca de vendido al lead (si esta era la
-- única venta confirmada que lo justificaba), para que al menos no
-- quede mal marcado hacia adelante.
create or replace function restablecer_venta(p_venta_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_lead_id uuid;
  v_estado_anterior text;
  v_otras_confirmadas int;
begin
  select lead_id, estado into v_lead_id, v_estado_anterior
  from ventas where id = p_venta_id;

  if not found then
    return jsonb_build_object('error', 'no_existe');
  end if;
  if v_estado_anterior not in ('confirmada', 'rechazada') then
    return jsonb_build_object('error', 'no_revisada');
  end if;

  update ventas
  set estado = 'pendiente', lead_id = null, campaign_id = null, revisado_en = null, revisado_por = null
  where id = p_venta_id;

  if v_lead_id is not null then
    select count(*) into v_otras_confirmadas
    from ventas
    where lead_id = v_lead_id and estado = 'confirmada' and id <> p_venta_id;

    if v_otras_confirmadas = 0 then
      update leads set vendido_at = null where id = v_lead_id;
    end if;
  end if;

  return jsonb_build_object('ok', true, 'estado_anterior', v_estado_anterior);
end;
$$;
