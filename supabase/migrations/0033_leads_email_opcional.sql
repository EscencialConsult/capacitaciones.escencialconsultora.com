-- Carga masiva de leads sin email (2026-08-31, pedido explícito: cargar
-- contactos desde el CSV que exporta el CRM propio, muchos de los
-- cuales solo tienen teléfono). Hasta acá `leads.email` era NOT NULL —
-- el único camino para crear un lead era el form público, que siempre
-- exige email (ver lib/leads.ts, eso NO cambia acá). Facundo pidió
-- explícito guardarlos igual aunque no tengan email, sin mandarles
-- ninguna campaña (sin a dónde mandarles nada, no hay otra opción).

alter table leads alter column email drop not null;

-- El índice único de siempre (campaign_id, lower(email)) no protege
-- reimportar el mismo contacto sin email dos veces — Postgres trata
-- cada NULL como distinto de los demás en un índice único, así que ahí
-- nunca chocaría. Este índice parcial cubre ESE caso puntual (dedupe
-- por teléfono, solo cuando no hay email) sin tocar el de siempre.
create unique index leads_campaign_phone_unique_idx
  on leads (campaign_id, phone)
  where email is null and phone is not null;

-- registrar_lead: acepta email vacío/null (antes el form público era el
-- único caller y siempre mandaba un email real). Sin email no hay a
-- dónde mandar nada, así que no se agenda ningún email_sends para ese
-- lead ni se reserva crédito — se guarda el contacto y listo. Con
-- email, el comportamiento es EXACTAMENTE el mismo de siempre (goteo
-- normal o envío personalizado, dedupe por email, créditos).
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
  v_email text := nullif(trim(p_email), '');
  v_phone text := nullif(trim(p_phone), '');
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
      p_campaign_id, v_email, p_first_name, p_last_name, v_phone,
      case when p_envio_personalizado then p_selected_option else null end
    )
    returning id, created_at into v_lead_id, v_created_at;

    if v_email is null then
      -- Sin email, sin ningún paso que agendar — ver comentario de arriba.
      v_pasos_a_agendar := 0;
    elsif p_envio_personalizado then
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

    if v_pasos_a_agendar > 0 then
      v_credito_ok := intentar_reservar_creditos(v_activated_by, p_campaign_id, v_lead_id, v_pasos_a_agendar);

      if not v_credito_ok then
        delete from leads where id = v_lead_id;
        return jsonb_build_object('es_duplicado', false, 'sin_credito', true);
      end if;
    end if;

    if v_email is not null then
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
    end if;

    return jsonb_build_object('es_duplicado', false, 'lead_id', v_lead_id);
  exception when unique_violation then
    -- Con email: constraint leads_campaign_email_unique_idx de siempre.
    -- Sin email: constraint leads_campaign_phone_unique_idx nueva (ver
    -- arriba) — mismo contacto sin email reimportado por teléfono.
    if v_email is not null then
      select id, selected_option into v_lead_existente_id, v_lead_existente_selected_option
      from leads
      where campaign_id = p_campaign_id and lower(email) = lower(v_email)
      for update;
    else
      select id, selected_option into v_lead_existente_id, v_lead_existente_selected_option
      from leads
      where campaign_id = p_campaign_id and email is null and phone = v_phone
      for update;
    end if;

    if not p_envio_personalizado or v_email is null then
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
