-- Config de Google OAuth, de toda la plataforma (2026-08-31, pedido
-- explícito: "hagamos una interfaz superadmin... esto de acreditar las
-- cuentas lo armamos nosotros en superadmin") — a diferencia de las API
-- keys de Brevo/Resend (una fila por admin), el Client ID/Secret de
-- Google es UNA sola config para todo el sistema (ver
-- lib/superadmin.ts). Singleton reforzado a nivel base: id fijo en 1,
-- el check constraint no deja insertar una segunda fila.
create table google_oauth_config (
  id int primary key default 1,
  client_id text not null,
  client_secret_encrypted text not null,
  configurado_por uuid references auth.users(id),
  configurado_en timestamptz not null default now(),
  check (id = 1)
);
alter table google_oauth_config enable row level security;
