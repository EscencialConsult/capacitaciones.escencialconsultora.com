-- SIN APLICAR TODAVÍA — pegar en Supabase > SQL Editor > New query > Run.
--
-- Bug real confirmado (2026-08-24) — en lib/email/process-pending.ts, si
-- SECRETS_ENCRYPTION_KEY cambia/se pierde (o se restaura un backup de base
-- cifrado bajo la key vieja) sin volver a conectar Brevo desde el panel,
-- decryptSecret() tira y el envío de TODAS las campañas se cortaba en
-- silencio: el único rastro era un console.error que se pierde en los logs
-- de la función de Netlify. Nadie se enteraba hasta que un lead reclamaba
-- no haber recibido el mail.
--
-- system_alerts guarda fallas de CONFIGURACIÓN que cortan el envío entero
-- (no una fila puntual de email_sends, que ya tiene su propio 'error' por
-- envío individual). Una sola fila por `source` (upsert, ver
-- registrarAlerta() en process-pending.ts): mientras el problema siga, cada
-- corrida del cron (cada 1 hora) pisa message/last_seen_at en vez de sumar
-- una fila nueva por corrida — así una tabla queda corta y un admin que la
-- mire ve hace cuánto viene fallando, no un spam de filas idénticas.
--
-- resolved_at queda pensado para cuando exista una pantalla de admin que
-- lea esta tabla (hoy no existe ninguna — el mínimo pedido era dejar un
-- rastro más visible que un console.error, no construir esa pantalla):
-- registrarAlerta() lo vuelve a poner en null cada vez que el problema
-- reaparece, así que una fila resuelta a mano que vuelve a fallar se
-- reabre sola.
create table system_alerts (
  id uuid primary key default gen_random_uuid(),
  source text not null unique,
  message text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table system_alerts enable row level security;
-- Mismo criterio que el resto de las tablas (ver 0001_init.sql): RLS
-- habilitado sin policies — el único acceso real es vía service role desde
-- el servidor, nunca desde el browser con la anon key.
