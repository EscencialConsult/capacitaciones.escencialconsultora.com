-- Cadencia de fecha fija por campaña (2026-08-28, pedido explícito) —
-- hasta ahora TODO paso de email se agendaba a offset_days contado
-- desde que SE REGISTRA CADA LEAD (goteo 100% relativo al lead). Pedido
-- nuevo: poder anclar un paso a una fecha fija de LA CAMPAÑA (offset_days
-- contado desde que se activó, igual para todos los leads) — por ejemplo
-- "día 0, 14, 25 y 30 de la promo", en vez de "0, 14, 25 y 30 días
-- después de que cada uno se anotó".
--
-- Regla de congruencia confirmada por Facundo con ejemplos concretos:
--   - El paso de offset_days = 0 SIEMPRE se manda inmediato al momento
--     del registro, sea cual sea su ancla — nunca cambia (mismo
--     comportamiento de siempre, no se toca).
--   - Un paso anclado a 'campana' (offset > 0) se agenda para
--     activated_at + offset_days, IGUAL para todos los leads.
--   - Si esa fecha YA PASÓ para cuando un lead puntual se registra, ese
--     paso se SALTEA para ese lead — nunca se manda atrasado/retroactivo.
--   - Ejemplo real de Facundo: pasos en 0, 14, 25 y 30. Alguien que se
--     registra el día 14 de la campaña recibe 0, 25 y 30 (el 14 se
--     saltea, coincide con su propio registro). Alguien que se registra
--     el día 25 recibe 0 y 30 (14 y 25 quedan atrás).
--   - Un paso anclado a 'lead' (default, comportamiento de siempre) no
--     cambia en nada — sigue siendo offset_days desde el registro de
--     CADA lead, nunca se saltea.

-- ── Cuándo arrancó la campaña de verdad ─────────────────────────────
-- No existía ningún timestamp de activación hasta ahora (activated_by
-- guarda QUIÉN, no CUÁNDO) — hace falta un ancla real para calcular
-- fechas fijas. Se setea UNA sola vez, en la primera activación
-- (coalesce en activar_campana/mover_landing_y_activar más abajo) —
-- pausar y reactivar después NO la corre de nuevo, para que los pasos
-- de fecha fija no se recalculen cada vez que se retoma una campaña.
alter table campaigns add column activated_at timestamptz;

-- Backfill de las campañas que ya estaban activas/pausadas antes de
-- esta columna existir — updated_at es la mejor aproximación real que
-- hay (no existe un timestamp de activación anterior), y ninguna de
-- estas campañas viejas tiene pasos con ancla='campana' todavía (la
-- columna se agrega recién abajo con default 'lead'), así que este
-- valor aproximado no afecta ningún cálculo real hasta que alguien
-- elija 'campana' a propósito en un paso nuevo.
update campaigns set activated_at = updated_at where status in ('active', 'paused');

-- ── Ancla por paso de email ──────────────────────────────────────────
-- 'lead' (default) = comportamiento de siempre, sin cambios. 'campana'
-- = fecha fija compartida por todos los leads, con la regla de arriba.
alter table landing_email_steps add column ancla text not null default 'lead' check (ancla in ('lead', 'campana'));

-- ── activar_campana: ahora también graba activated_at ───────────────
-- Mismo cuerpo que supabase/migrations/0009_activar_campana_atomica.sql,
-- solo se agrega activated_at = coalesce(activated_at, now()) al UPDATE
-- de la campaña que se activa — coalesce a propósito: si ya tenía una
-- fecha de una activación anterior (se pausó y se reactiva ahora), esa
-- fecha original NO se pisa.
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
      activated_at = case when id = p_campaign_id then coalesce(activated_at, now()) else activated_at end,
      updated_at = now()
  where landing_id = v_landing_id
    and (id = p_campaign_id or status = 'active');

  update landings set is_active = true where id = v_landing_id;
end;
$$;

-- ── mover_landing_y_activar: mismo agregado ──────────────────────────
-- Mismo cuerpo que supabase/migrations/0009_activar_campana_atomica.sql
-- (versión de 3 args), con el mismo coalesce de activated_at.
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
  set landing_id = p_landing_id_nuevo,
      status = 'active',
      activated_by = p_activated_by,
      activated_at = coalesce(activated_at, now()),
      updated_at = now()
  where id = p_campaign_id;

  update landings set is_active = true where id = p_landing_id_nuevo;
end;
$$;

-- ── crear_campana_con_pasos: ahora recibe también el ancla de cada paso ──
-- Mismo cuerpo que supabase/migrations/0014_crear_campana_atomica.sql,
-- con "ancla text" agregado a la fila esperada de p_pasos — coalesce a
-- 'lead' por si algún llamador viejo no lo manda (nunca null en la
-- columna real, que además tiene su propio default).
create or replace function crear_campana_con_pasos(
  p_landing_id uuid,
  p_name text,
  p_category_id uuid,
  p_advisor_name text,
  p_whatsapp_number text,
  p_whatsapp_message text,
  p_variables jsonb,
  p_pasos jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_campaign_id uuid;
begin
  insert into campaigns (
    landing_id, name, category_id, status,
    advisor_name, whatsapp_number, whatsapp_message, variables
  )
  values (
    p_landing_id, p_name, p_category_id, 'draft',
    p_advisor_name, p_whatsapp_number, p_whatsapp_message, coalesce(p_variables, '{}'::jsonb)
  )
  returning id into v_campaign_id;

  insert into landing_email_steps (campaign_id, step_number, email_template_id, offset_days, subject, content, ancla)
  select v_campaign_id, x.step_number, x.email_template_id, x.offset_days, x.subject, x.content, coalesce(x.ancla, 'lead')
  from jsonb_to_recordset(p_pasos) as x(
    step_number int,
    email_template_id uuid,
    offset_days int,
    subject text,
    content text,
    ancla text
  );

  return v_campaign_id;
end;
$$;

-- ── registrar_lead: agenda respetando el ancla de cada paso ──────────
-- Mismo cuerpo que supabase/migrations/0019_sistema_de_creditos.sql,
-- con la rama "goteo normal" reescrita: antes agendaba TODOS los pasos
-- activos sin condición; ahora, un paso anclado a 'campana' (con
-- offset_days > 0) se saltea si su fecha ya pasó para este lead. El
-- conteo de créditos a reservar (v_pasos_a_agendar) usa exactamente la
-- misma condición que el INSERT de abajo — nunca se cobra un crédito
-- por un paso que en los hechos se salteó.
create or replace function registrar_lead(
  p_campaign_id uuid,
  p_email text,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_selected_option int,
  p_envio_personalizado boolean
)
returns jsonb
language plpgsql
as $$
declare
  v_lead_id uuid;
  v_created_at timestamptz;
  v_lead_existente_id uuid;
  v_lead_existente_selected_option int;
  v_ya_envio_exito boolean;
  v_paso_correcto_id uuid;
  v_activated_by uuid;
  v_campaign_activated_at timestamptz;
  v_pasos_a_agendar int;
  v_credito_ok boolean;
begin
  select activated_by, activated_at into v_activated_by, v_campaign_activated_at
  from campaigns where id = p_campaign_id;

  begin
    insert into leads (campaign_id, email, first_name, last_name, phone, selected_option)
    values (
      p_campaign_id, p_email, p_first_name, p_last_name, nullif(p_phone, ''),
      case when p_envio_personalizado then p_selected_option else null end
    )
    returning id, created_at into v_lead_id, v_created_at;

    if p_envio_personalizado then
      v_pasos_a_agendar := 1;
    else
      select count(*) into v_pasos_a_agendar
      from landing_email_steps les
      where les.campaign_id = p_campaign_id
        and les.is_active = true
        and (
          les.ancla <> 'campana' or les.offset_days = 0
          or coalesce(v_campaign_activated_at, v_created_at) + (les.offset_days || ' days')::interval > v_created_at
        );
    end if;

    v_credito_ok := intentar_reservar_creditos(v_activated_by, p_campaign_id, v_lead_id, v_pasos_a_agendar);

    if not v_credito_ok then
      delete from leads where id = v_lead_id;
      return jsonb_build_object('es_duplicado', false, 'sin_credito', true);
    end if;

    if p_envio_personalizado then
      -- Envío personalizado: solo el paso cuyo step_number coincide con
      -- la opción elegida, siempre inmediato (scheduled_for = el propio
      -- momento de captura) — el ancla no aplica acá, es siempre 1 solo
      -- paso disparado al toque, mismo criterio de siempre.
      insert into email_sends (lead_id, landing_email_step_id, scheduled_for, status)
      select v_lead_id, les.id, v_created_at, 'pending'
      from landing_email_steps les
      where les.campaign_id = p_campaign_id
        and les.is_active = true
        and les.step_number = p_selected_option;
    else
      -- Goteo normal: un paso ancla='lead' (default) sigue siendo
      -- offset_days desde ESTE lead, exactamente como siempre. Un paso
      -- ancla='campana' con offset_days > 0 se agenda para la fecha fija
      -- de la campaña (activated_at + offset_days) — y si esa fecha ya
      -- pasó para este lead, el WHERE de abajo lo excluye del todo (no
      -- se inserta ninguna fila para ese paso, no se manda atrasado).
      insert into email_sends (lead_id, landing_email_step_id, scheduled_for, status)
      select
        v_lead_id,
        les.id,
        case
          when les.ancla = 'campana' and les.offset_days > 0
            then coalesce(v_campaign_activated_at, v_created_at) + (les.offset_days || ' days')::interval
          else v_created_at + (les.offset_days || ' days')::interval
        end,
        'pending'
      from landing_email_steps les
      where les.campaign_id = p_campaign_id
        and les.is_active = true
        and (
          les.ancla <> 'campana' or les.offset_days = 0
          or coalesce(v_campaign_activated_at, v_created_at) + (les.offset_days || ' days')::interval > v_created_at
        );
    end if;

    return jsonb_build_object('es_duplicado', false, 'lead_id', v_lead_id);
  exception when unique_violation then
    -- Constraint leads_campaign_email_unique_idx (campaign_id, lower(email))
    -- ya disparó -> este lead ya estaba registrado en esta campaña.
    select id, selected_option into v_lead_existente_id, v_lead_existente_selected_option
    from leads
    where campaign_id = p_campaign_id and lower(email) = lower(p_email)
    for update;

    if not p_envio_personalizado then
      return jsonb_build_object('es_duplicado', true, 'lead_id', v_lead_existente_id);
    end if;

    select exists(
      select 1 from email_sends where lead_id = v_lead_existente_id and status = 'sent'
    ) into v_ya_envio_exito;

    select id into v_paso_correcto_id
    from landing_email_steps
    where campaign_id = p_campaign_id and is_active = true and step_number = p_selected_option;

    if not v_ya_envio_exito and v_paso_correcto_id is not null then
      v_credito_ok := intentar_reservar_creditos(v_activated_by, p_campaign_id, v_lead_existente_id, 1);

      if not v_credito_ok then
        return jsonb_build_object('es_duplicado', true, 'lead_id', v_lead_existente_id, 'sin_credito', true);
      end if;

      if v_lead_existente_selected_option is distinct from p_selected_option then
        update leads set selected_option = p_selected_option where id = v_lead_existente_id;
      end if;

      delete from email_sends
      where lead_id = v_lead_existente_id
        and status <> 'sent';

      insert into email_sends (lead_id, landing_email_step_id, scheduled_for, status)
      values (v_lead_existente_id, v_paso_correcto_id, now(), 'pending');
    end if;

    return jsonb_build_object('es_duplicado', true, 'lead_id', v_lead_existente_id);
  end;
end;
$$;
