-- Desde ahora un envío puede salir por Brevo O por Resend, según la
-- cuenta del dueño de la campaña (ver process-pending.ts). Esta columna
-- desambigua a qué proveedor corresponden brevo_message_id/
-- brevo_account_id (que siguen usándose como el slot genérico de
-- "id del mensaje / cuenta que mandó" — nombre heredado de cuando solo
-- existía Brevo, no vale la pena renombrar dos columnas por esto).
alter table email_sends add column provider text check (provider in ('brevo', 'resend'));

-- Los envíos ya hechos fueron todos por Brevo (Resend recién arranca a
-- usarse hoy) — backfill honesto, no queda ningún NULL ambiguo en filas
-- que sí tienen un brevo_message_id real.
update email_sends set provider = 'brevo' where status = 'sent' and provider is null;
