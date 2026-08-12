-- Separar Campañas (contenido de marketing) de Landings (el link
-- público + diseño). Hasta acá una sola fila de `landings` jugaba los
-- dos roles — arrancaba 'draft' (aparecía en /admin/campaigns) y al
-- activarse pasaba a 'active' (aparecía en /admin/landings), la MISMA
-- fila desaparecía de Campañas. Esta migración preserva toda la data
-- real ya existente (4 landings, 3 leads, 7 pasos de email, 6 envíos
-- al momento de escribir esto).

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  landing_id uuid not null references landings(id),
  name text not null,
  variables jsonb not null default '{}',
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'archived')),
  advisor_name text,
  whatsapp_number text,
  whatsapp_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index campaigns_landing_id_idx on campaigns (landing_id);
create index campaigns_status_idx on campaigns (status);
-- Como mucho UNA campaña activa por landing, reforzado en la base (no
-- solo en el código): activar una segunda sin pausar la anterior
-- rompe con 23505 en vez de dejar dos activas silenciosamente.
create unique index campaigns_one_active_per_landing_idx
  on campaigns (landing_id) where status = 'active';

-- Backfill: una campaña por landing existente. 1:1 exacto en este
-- momento (landings.id es PK, así que no hay ambigüedad al mapear
-- landing_id -> campaigns.id más abajo) — se hace ANTES de que
-- landings pierda estas columnas, para no perder nada.
insert into campaigns (landing_id, name, variables, status, advisor_name, whatsapp_number, whatsapp_message, created_at, updated_at)
select id, name, variables, status, advisor_name, whatsapp_number, whatsapp_message, created_at, updated_at
from landings;

alter table landing_email_steps add column campaign_id uuid references campaigns(id) on delete cascade;
alter table leads add column campaign_id uuid references campaigns(id);

update landing_email_steps les set campaign_id = c.id from campaigns c where c.landing_id = les.landing_id;
update leads l set campaign_id = c.id from campaigns c where c.landing_id = l.landing_id;

alter table landing_email_steps alter column campaign_id set not null;
alter table leads alter column campaign_id set not null;

-- Nombres de constraint/índice verificados en vivo contra la base
-- real antes de escribir esto (select conname from pg_constraint...).
alter table landing_email_steps drop constraint landing_email_steps_landing_id_step_number_key;
alter table landing_email_steps add constraint landing_email_steps_campaign_id_step_number_key unique (campaign_id, step_number);
drop index leads_landing_idx;
create index leads_campaign_idx on leads (campaign_id);
drop index leads_landing_email_unique_idx;
create unique index leads_campaign_email_unique_idx on leads (campaign_id, lower(email));

alter table landing_email_steps drop column landing_id;
alter table leads drop column landing_id;

-- landings: sacar lo que ahora vive en campaigns, sumar categoría, y
-- pasar de un status de 4 valores a is_active (mismo patrón que
-- landing_templates/email_templates, que ya usan is_active) — el
-- ciclo de vida draft/active/paused/archived ahora es 100% de
-- campaigns.status; una landing solo responde "¿existe esta URL o no?".
-- Una landing vieja que nunca se activó mantiene su única campaña
-- heredada en status='draft' (por el backfill de arriba), así que
-- aunque is_active quede en true, /[slug] sigue sin servirla — mismo
-- comportamiento público de antes, sin sorpresas.
drop index landings_status_idx;
alter table landings
  drop column status,
  drop column variables,
  drop column advisor_name,
  drop column whatsapp_number,
  drop column whatsapp_message;
alter table landings add column is_active boolean not null default true;
alter table landings add column category_id uuid references landing_categories(id);

alter table campaigns enable row level security;
