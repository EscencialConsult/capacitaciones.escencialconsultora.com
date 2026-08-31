-- Google suma al cálculo de créditos mensuales (2026-08-31) — mismo
-- criterio que Brevo/Resend: free = límite real y público del
-- proveedor, pago = lo declarado a mano. Límites reales de Gmail API
-- (confirmados 2026-08-31): personal 500 destinatarios/día (×30 =
-- 15.000/mes), Google Workspace 2.000/día (×30 = 60.000/mes).
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
    union all
    select case
      when plan_tipo = 'pago' then coalesce(creditos_pago, 0)
      when tipo_cuenta = 'workspace' then 2000 * 30
      else 500 * 30
    end as monto
    from google_accounts where user_id = p_user_id
  ) cuentas;
$$;
