-- Fix chico (2026-08-31) — creditos_mensuales_de() contaba la capacidad
-- de una cuenta de Resend aunque su dominio todavía estuviera
-- "pendiente" de verificar (ver lib/dominio-resend.ts, migración 0025):
-- sender_email queda null hasta que Resend confirma, y sin esta
-- condición esos créditos "existían" en el cálculo aunque todavía no
-- hubiera con qué mandar nada de verdad (mismo hueco que se cerró en
-- resolverCuentaDeEnvio(), lib/email/process-pending.ts).
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
    from resend_accounts where user_id = p_user_id and sender_email is not null
  ) cuentas;
$$;
