-- El diseño de email de cada paso pasa a ser opcional: si no se elige
-- ninguno, el sistema manda un email "simple" de respaldo (ver
-- lib/email/process-pending.ts → HTML_EMAIL_MANUAL_FALLBACK) en vez de
-- bloquear la creación de la campaña exigiendo un diseño.
alter table landing_email_steps
  alter column email_template_id drop not null;
