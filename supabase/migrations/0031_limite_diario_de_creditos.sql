-- Límite diario, no solo mensual (2026-08-31, pedido explícito: "tengo
-- varios límites diario, que sea así también, como ya está armada la
-- plataforma") — hasta ahora el sistema solo controlaba el total
-- MENSUAL agregado (creditos_mensuales_de, migración 0019/0026/0029),
-- pero Brevo y Google en los hechos cortan por DÍA (300/día Brevo free,
-- 500 o 2.000/día Google) — un pico de leads en un solo día podía
-- consumir del pool mensual sin que el sistema avisara que ESE día en
-- particular ya se pasó del límite real que el proveedor va a aceptar
-- (Brevo empieza a devolver 429 apenas se pasa de 300 en el día, sin
-- importar cuánto quede del mes). Resend NO tiene un límite diario
-- publicado (su free tier es 3.000/mes sin tope diario declarado) — no
-- suma acá, solo sigue sumando al total mensual de siempre.

-- ── Inicio del día actual en hora Argentina ──────────────────────────
-- No UTC — un lead que se registra a las 23:50 hora Argentina no puede
-- contar para "mañana" solo porque el servidor de Supabase corre en UTC.
create or replace function inicio_dia_actual(p_momento timestamptz default now())
returns timestamptz
language sql
stable
as $$
  select date_trunc('day', p_momento at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires';
$$;

-- ── Límite diario disponible para un usuario ─────────────────────────
-- Suma SOLO de las cuentas que tienen un tope diario real y público
-- (Brevo, Google) — Resend no aporta nada acá. plan_tipo='pago' tampoco
-- suma: un plan pago se declara con un total MENSUAL a mano (ver
-- PlanPagoStub), sin desglose diario conocido, así que esa cuenta no
-- agrega ningún tope diario propio (si es la única cuenta conectada,
-- v_limite_diario da 0 y el chequeo diario queda sin efecto, ver más
-- abajo — solo rige el mensual, que si contempla el plan pago).
create or replace function limite_diario_de(p_user_id uuid)
returns int
language sql
stable
as $$
  select coalesce(sum(monto), 0)::int from (
    select daily_limit as monto from brevo_accounts where user_id = p_user_id and is_active and plan_tipo = 'free'
    union all
    select case when tipo_cuenta = 'workspace' then 2000 else 500 end as monto
    from google_accounts where user_id = p_user_id and plan_tipo = 'free'
  ) cuentas;
$$;

create or replace function creditos_usados_hoy(p_user_id uuid)
returns int
language sql
stable
as $$
  select coalesce(sum(credits), 0)::int
  from credit_ledger
  where user_id = p_user_id and created_at >= inicio_dia_actual();
$$;

-- ── intentar_reservar_creditos: ahora también chequea el día ────────
-- Mismo cuerpo que la migración 0019, con el chequeo diario agregado
-- ANTES de reservar — si cualquiera de los dos topes (mensual o diario)
-- no alcanza, se pausa la campaña igual que antes, sin distinguir cuál
-- de los dos fue (el admin ve el detalle real en Mi perfil).
-- v_limite_diario = 0 (ninguna cuenta con tope diario conocido, ej.
-- solo Resend conectado) desactiva el chequeo diario por completo, no
-- lo hace fallar siempre.
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
  v_disponible_mes int;
  v_limite_diario int;
  v_disponible_hoy int;
begin
  if p_user_id is null or p_credits <= 0 then
    return true;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  v_disponible_mes := creditos_mensuales_de(p_user_id) - creditos_usados_ciclo_actual(p_user_id);
  v_limite_diario := limite_diario_de(p_user_id);
  v_disponible_hoy := case when v_limite_diario > 0 then v_limite_diario - creditos_usados_hoy(p_user_id) else null end;

  if v_disponible_mes < p_credits or (v_disponible_hoy is not null and v_disponible_hoy < p_credits) then
    update campaigns set status = 'paused', updated_at = now()
    where id = p_campaign_id and status = 'active';
    return false;
  end if;

  insert into credit_ledger (user_id, campaign_id, lead_id, credits)
  values (p_user_id, p_campaign_id, p_lead_id, p_credits);

  return true;
end;
$$;
