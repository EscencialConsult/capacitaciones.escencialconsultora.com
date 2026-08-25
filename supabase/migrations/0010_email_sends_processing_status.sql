-- Bug real confirmado (2026-08-24, Ronda 2) — processPendingEmails()
-- (lib/email/process-pending.ts) no tenía ningún lock ni estado
-- intermedio: dos ejecuciones concurrentes (el cron de Netlify + el
-- botón "Enviar pendientes ahora" clickeado casi al mismo tiempo, o dos
-- invocaciones del cron solapadas) podían leer el mismo email_sends
-- 'pending' y mandarlo dos veces por Brevo, sin ningún error visible en
-- ningún lado.
--
-- Se agrega 'processing' al check constraint — process-pending.ts ahora
-- "reclama" cada fila con un UPDATE condicional (pending → processing)
-- ANTES de llamar a Brevo, y solo sigue si esa escritura afectó
-- realmente una fila (si otra ejecución ya la reclamó, esta la salta).
alter table email_sends drop constraint email_sends_status_check;
alter table email_sends add constraint email_sends_status_check
  check (status in ('pending', 'processing', 'sent', 'error', 'skipped'));
