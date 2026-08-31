-- Cuenta de Google por admin (2026-08-31, pedido explícito) — 3er
-- proveedor de envío, junto a brevo_accounts/resend_accounts. A
-- diferencia de esas dos (API key pegada a mano), acá se conecta por
-- OAuth (ver lib/google-oauth.ts) — lo único que se guarda es el
-- refresh_token, cifrado igual que el resto de los secretos del panel.
--
-- tipo_cuenta: se detecta SOLO (no se le pregunta al admin) leyendo el
-- claim "hd" (hosted domain) del id_token que devuelve Google en el
-- intercambio — presente únicamente en cuentas de Google Workspace,
-- ausente en Gmail personal. Determina el límite diario real (ver
-- creditos_mensuales_de, migración 0029): personal 500/día, Workspace
-- 2000/día.
create table google_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id),
  google_email text not null,
  refresh_token_encrypted text not null,
  tipo_cuenta text not null default 'personal' check (tipo_cuenta in ('personal', 'workspace')),
  plan_tipo text not null default 'free' check (plan_tipo in ('free', 'pago')),
  creditos_pago int,
  validated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table google_accounts enable row level security;
