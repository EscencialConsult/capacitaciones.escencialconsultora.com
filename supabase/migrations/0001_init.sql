-- Plataforma de Landings + Emails — schema inicial
-- Pegar completo en Supabase > SQL Editor > New query > Run.
--
-- Nombres de tabla/columna en inglés, ASCII, snake_case a propósito: el
-- bug que más dolió en el sistema viejo (Google Sheets) fue un encabezado
-- con "ñ" tipeado distinto al que esperaba el código. Con columnas reales
-- de Postgres + TypeScript generado desde el schema, ese error se detecta
-- al guardar el archivo, no en producción.

create extension if not exists "pgcrypto";

-- ── Categorías de landing (editable sin tocar código) ──────────────
create table landing_categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  created_at timestamptz not null default now()
);

-- ── Plantillas de landing (diseños de página reutilizables) ────────
create table landing_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_id uuid references landing_categories(id),
  html_content text not null,
  variables_schema jsonb not null default '[]',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Plantillas de email (mismo mecanismo de placeholders) ──────────
create table email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  html_content text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Landings = "el link" (reemplaza el concepto de campaña) ────────
create table landings (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  template_id uuid not null references landing_templates(id),
  variables jsonb not null default '{}',
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'archived')),
  advisor_name text,
  whatsapp_number text,
  whatsapp_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index landings_status_idx on landings (status);

-- ── Pasos de email por landing (normalizado, sin límite de 4) ──────
create table landing_email_steps (
  id uuid primary key default gen_random_uuid(),
  landing_id uuid not null references landings(id) on delete cascade,
  step_number int not null,
  email_template_id uuid not null references email_templates(id),
  offset_days int not null default 0,
  subject text not null,
  content text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (landing_id, step_number)
);

-- ── Leads ───────────────────────────────────────────────────────────
create table leads (
  id uuid primary key default gen_random_uuid(),
  landing_id uuid not null references landings(id),
  email text not null,
  first_name text,
  last_name text,
  phone text,
  extra jsonb not null default '{}',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  whatsapp_clicked_at timestamptz,
  whatsapp_clicked_step int,
  created_at timestamptz not null default now(),
  unique (landing_id, lower(email))
);

create index leads_landing_idx on leads (landing_id);

-- ── Cuentas de Brevo (modelo listo para rotación futura) ───────────
-- La API key NUNCA vive acá — env_var_name apunta al nombre de la
-- variable de entorno en Netlify que contiene la key real.
create table brevo_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  env_var_name text not null,
  sender_email text not null,
  sender_name text not null,
  daily_limit int not null default 300,
  emails_sent_today int not null default 0,
  last_reset_at date not null default current_date,
  priority int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── Envíos programados/realizados (reemplaza fecha_envio_N/estado_N) ──
create table email_sends (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  landing_email_step_id uuid not null references landing_email_steps(id),
  scheduled_for timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'error', 'skipped')),
  sent_at timestamptz,
  error_message text,
  brevo_message_id text,
  brevo_account_id uuid references brevo_accounts(id),
  created_at timestamptz not null default now()
);

create index email_sends_pending_idx on email_sends (status, scheduled_for)
  where status = 'pending';

-- ── RLS: habilitado en todo, sin policies públicas ─────────────────
-- El acceso real pasa siempre por la service role key en el servidor
-- (nunca desde el navegador). Esto es un cinturón de seguridad extra,
-- no el mecanismo principal de control de acceso.
alter table landing_categories enable row level security;
alter table landing_templates enable row level security;
alter table email_templates enable row level security;
alter table landings enable row level security;
alter table landing_email_steps enable row level security;
alter table leads enable row level security;
alter table brevo_accounts enable row level security;
alter table email_sends enable row level security;
