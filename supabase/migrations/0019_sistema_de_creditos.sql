-- Sistema de créditos por persona (2026-08-26, pedido explícito) —
-- segunda pieza sobre la base de 0018 (cuentas y campañas con dueño).
-- Modelo confirmado por Facundo:
--   - Créditos mensuales = suma del free tier de cada cuenta de
--     Brevo/Resend que esa persona conectó (Brevo 300/día → ×30;
--     Resend 3000/mes, publicado tal cual por Resend), más un número
--     declarado a mano si en algún momento se marca la cuenta como
--     plan pago (plan_tipo/creditos_pago abajo — placeholder: hoy no
--     hay ningún botón real de "activar plan pago" en la UI, se deja
--     la columna lista para cuando haga falta implementarlo).
--   - Ciclo mensual anclado al día 25 (no al 1ro) — es el día real en
--     que arrancó este sistema.
--   - Reserva COMPLETA al registrarse el lead (no incremental por
--     email realmente enviado) — un lead en una campaña de 3 pasos
--     reserva 3 créditos de una, aunque el paso 3 tenga offset_days y
--     tarde días en salir de verdad.
--   - Si una campaña activa se queda sin crédito de su dueño, se
--     pausa sola — otra persona (con sus propios créditos) puede
--     activarla, o el dueño original puede reactivarla cuando el
--     ciclo siguiente le devuelva crédito disponible.

-- ── Plan declarado por cuenta conectada ─────────────────────────────
alter table brevo_accounts add column plan_tipo text not null default 'free' check (plan_tipo in ('free', 'pago'));
alter table brevo_accounts add column creditos_pago int;
alter table resend_accounts add column plan_tipo text not null default 'free' check (plan_tipo in ('free', 'pago'));
alter table resend_accounts add column creditos_pago int;

-- ── Ciclo mensual anclado al 25 ─────────────────────────────────────
-- Antes del día 25 de un mes, el ciclo actual arrancó el 25 del mes
-- anterior. Desde el 25 en adelante, arrancó el 25 de este mes.
create or replace function inicio_ciclo_creditos(p_momento timestamptz default now())
returns timestamptz
language sql
immutable
as $$
  select case
    when extract(day from p_momento) >= 25
      then date_trunc('month', p_momento) + interval '24 days'
    else date_trunc('month', p_momento) - interval '1 month' + interval '24 days'
  end;
$$;

-- ── Créditos mensuales disponibles para un usuario ──────────────────
-- Suma de sus cuentas conectadas y activas. Free = límite real y
-- público del proveedor; pago = lo declarado a mano (0 si se marcó
-- 'pago' pero nunca se cargó un número — nunca se inventa un valor).
create or replace function creditos_mensuales_de(p_user_id uuid)
returns int
language sql
stable
as $$
  select coalesce(sum(monto), 0)::int from (
    select case when plan_tipo = 'pago' then coalesce(creditos_pago, 0) else daily_limit * 30 end as monto
    from brevo_accounts where user_id = p_user_id and is_active
    union all
    select case when plan_tipo = 'pago' then coalesce(creditos_pago, 0) else 3000 end as monto
    from resend_accounts where user_id = p_user_id
  ) cuentas;
$$;

-- ── Consumo (reservado) ──────────────────────────────────────────────
-- Una fila por lead que efectivamente reservó crédito — nunca se
-- borra ni se actualiza, es el historial real de consumo (sirve tanto
-- para el medidor "en vivo" como para el detalle de campañas en Mi
-- perfil). `credits` = pasos de email activos que tenía la campaña en
-- el momento exacto del registro.
create table credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  campaign_id uuid not null references campaigns(id),
  lead_id uuid not null references leads(id) on delete cascade,
  credits int not null check (credits > 0),
  created_at timestamptz not null default now()
);
create index credit_ledger_user_ciclo_idx on credit_ledger (user_id, created_at);
create index credit_ledger_campaign_idx on credit_ledger (campaign_id);
alter table credit_ledger enable row level security;

create or replace function creditos_usados_ciclo_actual(p_user_id uuid)
returns int
language sql
stable
as $$
  select coalesce(sum(credits), 0)::int
  from credit_ledger
  where user_id = p_user_id and created_at >= inicio_ciclo_creditos();
$$;

-- ── Reserva atómica ──────────────────────────────────────────────────
-- Chequea disponible vs. lo pedido; si alcanza, reserva (inserta en
-- credit_ledger) y devuelve true. Si no alcanza, pausa la campaña
-- (nadie más puede seguir registrándose bajo un dueño sin crédito) y
-- devuelve false — SIN lanzar excepción: quedarse sin crédito es un
-- resultado esperado del negocio, no un error, así que el pausado se
-- graba igual aunque el registro del lead que lo disparó no prospere
-- (ver registrar_lead más abajo, que hace el rollback del lead a mano
-- con un DELETE en vez de con una excepción que también deshaga esto).
--
-- pg_advisory_xact_lock sobre el user_id serializa dos registros
-- concurrentes del MISMO dueño (dos leads entrando casi al mismo
-- tiempo, en la misma o distinta campaña) — sin esto, ambos podrían
-- leer "hay crédito" a la vez y las dos reservas juntas superar lo
-- disponible. Se libera solo al terminar la transacción.
create or replace function intentar_reservar_creditos(
  p_user_id uuid,
  p_campaign_id uuid,
  p_lead_id uuid,
  p_credits int
)
returns boolean
language plpgsql
as $$
declare
  v_disponible int;
begin
  -- Campaña sin dueño (activada antes del 25/8, o cualquier caso
  -- legado) — no hay a quién cobrarle, no se bloquea nada. Facundo
  -- pidió contar desde el 25/8 en adelante, no reconstruir el pasado.
  if p_user_id is null or p_credits <= 0 then
    return true;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  v_disponible := creditos_mensuales_de(p_user_id) - creditos_usados_ciclo_actual(p_user_id);

  if v_disponible < p_credits then
    update campaigns set status = 'paused', updated_at = now()
    where id = p_campaign_id and status = 'active';
    return false;
  end if;

  insert into credit_ledger (user_id, campaign_id, lead_id, credits)
  values (p_user_id, p_campaign_id, p_lead_id, p_credits);

  return true;
end;
$$;

-- ── registrar_lead: ahora reserva crédito antes de agendar emails ──
-- Mismo cuerpo que 0015, con el chequeo de crédito insertado en los
-- dos puntos donde se agendan email_sends NUEVOS (alta nueva, y
-- reprogramación de envío personalizado en la rama de duplicado). Si
-- no alcanza el crédito, no se agenda nada y el lead recién insertado
-- se borra a mano (DELETE, no excepción) — así el pausado de la
-- campaña, que sí queremos que quede grabado, no se deshace con él.
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
  v_pasos_a_agendar int;
  v_credito_ok boolean;
begin
  select activated_by into v_activated_by from campaigns where id = p_campaign_id;

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
      from landing_email_steps
      where campaign_id = p_campaign_id and is_active = true;
    end if;

    v_credito_ok := intentar_reservar_creditos(v_activated_by, p_campaign_id, v_lead_id, v_pasos_a_agendar);

    if not v_credito_ok then
      delete from leads where id = v_lead_id;
      return jsonb_build_object('es_duplicado', false, 'sin_credito', true);
    end if;

    if p_envio_personalizado then
      -- Envío personalizado: solo el paso cuyo step_number coincide con
      -- la opción elegida, siempre inmediato (scheduled_for = el propio
      -- momento de captura) — mismo criterio que tenía route.ts.
      insert into email_sends (lead_id, landing_email_step_id, scheduled_for, status)
      select v_lead_id, les.id, v_created_at, 'pending'
      from landing_email_steps les
      where les.campaign_id = p_campaign_id
        and les.is_active = true
        and les.step_number = p_selected_option;
    else
      -- Goteo normal: todos los pasos activos, cada uno con su propio
      -- offset_days sumado al momento de captura.
      insert into email_sends (lead_id, landing_email_step_id, scheduled_for, status)
      select v_lead_id, les.id, v_created_at + (les.offset_days || ' days')::interval, 'pending'
      from landing_email_steps les
      where les.campaign_id = p_campaign_id
        and les.is_active = true;
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
