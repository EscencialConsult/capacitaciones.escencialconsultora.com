-- Kit de marca editable (2026-08-28, pedido explícito) — hasta ahora
-- MARCAS en lib/landing-template-defaults.ts es un objeto hardcodeado
-- en código (4 marcas fijas: one, escencial-latam, escencial-argentina,
-- esseleccion), cargado a mano por un dev. Facundo confirmó el alcance:
-- esas 4 quedan EXACTAMENTE como están (no se migran a la base, cero
-- riesgo para plantillas/prompts existentes) — esto es ADITIVO, un
-- sistema paralelo para que cualquier admin pueda crear SU PROPIA marca
-- desde el panel (colores + logos subidos una vez), sin tocar código.
--
-- landing_templates.marca (texto, 4 valores fijos vía check constraint,
-- ver 0005_marca_en_landing_templates.sql) NO se toca — se agrega una
-- columna nueva y separada, mutuamente excluyente con esa: una
-- plantilla usa UNA de las dos, nunca ambas a la vez (validado en la
-- app, en actions.ts — no hace falta un CHECK acá, no vale la pena el
-- riesgo de tocar la constraint existente para esto).
create table marcas_personalizadas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  colores text[] not null default '{}',
  degradado text,
  tipografia_principal text not null default 'Inter',
  tipografias_secundarias text[] not null default '{}',
  -- URLs públicas del bucket de Storage "marca-logos" (ver script de
  -- setup del bucket, corrido aparte — no hay migración de Storage en
  -- SQL). Igual que MARCAS hardcodeada, se piden los 3 (fondo oscuro,
  -- fondo claro, ícono solo) para que el prompt de plantilla pueda
  -- usar el que corresponda según la sección, mismo criterio que las
  -- 4 marcas fijas.
  logo_blanco text not null,
  logo_negro text not null,
  logo_isotipo text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- RLS habilitada SIN políticas a propósito — mismo criterio que
-- credit_ledger (migración 0019) y el resto de las tablas de este
-- panel: todo el acceso real pasa por el service_role desde server
-- actions, nunca se consulta esta tabla con la anon key desde el
-- cliente, así que deny-all para esa key es exactamente lo que
-- corresponde, no hace falta escribir ninguna policy.
alter table marcas_personalizadas enable row level security;

alter table landing_templates
  add column marca_personalizada_id uuid references marcas_personalizadas(id);
