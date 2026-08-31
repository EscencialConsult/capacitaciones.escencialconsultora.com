-- Google como 3er proveedor real de envío (2026-08-31) — mismo patrón
-- que brevo_account_id/resend_account_id (migración 0022): cada
-- proveedor tiene su propia columna con su propia FK, nunca se reusa
-- una columna genérica entre proveedores distintos (ese error ya costó
-- un bug real de "queda en processing para siempre", ver el comentario
-- completo en lib/email/process-pending.ts).
alter table email_sends add column google_account_id uuid references google_accounts(id);
