-- Panel de Integraciones (2026-08-24) — /admin/settings/integrations,
-- para que un admin sin conocimientos técnicos conecte Brevo/Resend
-- pegando la API key en un formulario, en vez de tener que cargar una
-- variable de entorno en Netlify a mano.
--
-- Brevo YA tenía brevo_accounts (env_var_name apunta a una env var con
-- la key real) — se le suman columnas para el flujo nuevo de "pegá tu
-- key acá", sin sacar env_var_name: si un admin conecta desde el panel,
-- api_key_encrypted pasa a tener prioridad (ver
-- lib/email/process-pending.ts); si nunca lo hace, sigue funcionando
-- con la env var de siempre, sin romper nada de lo que ya está en
-- producción.
alter table brevo_accounts add column api_key_encrypted text;
alter table brevo_accounts add column api_key_last4 text;
alter table brevo_accounts add column validated_at timestamptz;

-- Una cuenta creada 100% desde el panel (sin ninguna variable de entorno
-- de por medio) no tiene ningún env_var_name real que poner acá — antes
-- era NOT NULL porque hasta ahora TODA fila implicaba una env var real.
-- lib/email/process-pending.ts ya prioriza api_key_encrypted cuando está
-- presente, así que env_var_name puede quedar en null sin romper nada.
alter table brevo_accounts alter column env_var_name drop not null;

-- Resend es un proveedor nuevo, sin ninguna tabla previa — a diferencia
-- de brevo_accounts, no tiene rotación multi-cuenta ni límite diario
-- todavía (nada en el sistema manda emails por Resend hoy, ver el
-- comentario en app/admin/(dashboard)/settings/integrations/actions.ts);
-- esta tabla solo guarda LA conexión (siempre una fila como mucho, el
-- panel la trata como singleton) para cuando se implemente el envío.
create table resend_accounts (
  id uuid primary key default gen_random_uuid(),
  api_key_encrypted text not null,
  api_key_last4 text not null,
  validated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table resend_accounts enable row level security;
-- Mismo criterio que el resto de las tablas (ver 0001_init.sql): RLS
-- habilitado sin policies — el único acceso real es vía service role
-- desde el servidor, nunca desde el browser con la anon key.
