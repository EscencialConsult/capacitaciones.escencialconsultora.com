-- Aprobación de conexión de Google por superadmin (2026-08-31, pedido
-- explícito) — Google, mientras la app esté en modo "Prueba", solo deja
-- loguearse a los emails que un superadmin agregó a mano como "Test
-- user" en Google Cloud Console (no hay API para hacerlo por código,
-- confirmado real en producción — ver [[google_oauth_no_cookies_bug]]
-- para el resto de lo que ya se descubrió de este flujo). Antes, un
-- admin nuevo se encontraba con el error recién al intentar conectar,
-- sin ningún aviso previo. Ahora: el admin pide acceso desde Integraciones
-- → el superadmin ve el pedido en /admin/superadmin, va a Google Cloud
-- Console y agrega el email (paso manual, no automatizable), vuelve y
-- aprueba → recién ahí el admin ve el botón real de "Conectar con Google".
--
-- Tabla separada de google_accounts a propósito: google_accounts
-- representa una conexión YA COMPLETADA (tiene columnas obligatorias
-- como el refresh_token, que no existen hasta que el OAuth realmente
-- termina) — esto es solo el pedido/aprobación previo, con su propio
-- ciclo de vida.
create table google_connection_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobado', 'rechazado')),
  solicitado_en timestamptz not null default now(),
  aprobado_por uuid references auth.users(id),
  aprobado_en timestamptz
);
alter table google_connection_requests enable row level security;
