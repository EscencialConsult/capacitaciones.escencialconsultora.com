-- Sistema de revisión de ventas (2026-09-01, pedido explícito) — el
-- marcado automático y silencioso de las migraciones 0034/0035 sigue
-- existiendo como CONCEPTO (marcar vendido = cancelar lo pendiente),
-- pero ahora nada se marca solo: cada venta que llega por
-- app/api/ventas-sync/route.ts entra a una cola de revisión
-- (`ventas`, más abajo) con una sugerencia de a qué lead/campaña
-- corresponde, y Facundo confirma o rechaza a mano desde /admin/ventas.
--
-- Por qué: el sync anterior actuaba solo con un único criterio (email
-- exacto). Pedido explícito: "esto debe ser un sistema muy avanzado,
-- casi como IA pero sin IA" — matchear también por teléfono y, cuando
-- ninguno de los dos alcanza, por nombre+apellido PERO acotado primero
-- por tema (palabras clave del "Programa" contra el nombre de la
-- campaña) y por fecha (¿la venta cayó dentro de la ventana en que esa
-- campaña estuvo activa?) — así el nombre nunca se compara contra TODA
-- la base, achica el universo antes, reduciendo el riesgo real de
-- coincidencia de nombres que el propio Facundo señaló.

-- ── Ventana real de "cuándo estuvo activa" una campaña ──────────────
-- Hasta ahora solo existía activated_at (CUÁNDO arrancó) — nunca se
-- registraba cuándo se pausó/archivó. Sin esto, "¿la venta cayó dentro
-- de la ventana en que la campaña estuvo activa?" no se puede
-- calcular para una campaña que ya no está activa hoy.
alter table campaigns add column deactivated_at timestamptz;

-- activar_campana: limpia deactivated_at de la que se activa (vuelve a
-- quedar con ventana abierta) y sella deactivated_at = now() en la que
-- se pausa automáticamente como efecto colateral de esta activación
-- (la otra activa de la misma landing, si había una). El WHERE de la
-- query ya garantiza que cualquier fila afectada que NO sea
-- p_campaign_id tenía status='active' ANTES de este UPDATE — por eso
-- alcanza con "else now()", no hace falta comparar el status viejo a mano.
create or replace function activar_campana(p_campaign_id uuid, p_activated_by uuid)
returns void
language plpgsql
as $$
declare
  v_landing_id uuid;
  v_status text;
begin
  select landing_id into v_landing_id
  from campaigns
  where id = p_campaign_id;

  if v_landing_id is null then
    raise exception 'No se encontró la campaña.';
  end if;

  perform 1 from campaigns where landing_id = v_landing_id order by id for update;

  select status into v_status from campaigns where id = p_campaign_id;

  if v_status not in ('draft', 'paused') then
    raise exception 'Solo se puede activar una campaña que esté en borrador o pausada.';
  end if;

  update campaigns
  set status = case when id = p_campaign_id then 'active' else 'paused' end,
      activated_by = case when id = p_campaign_id then p_activated_by else activated_by end,
      activated_at = case when id = p_campaign_id then coalesce(activated_at, now()) else activated_at end,
      deactivated_at = case when id = p_campaign_id then null else now() end,
      updated_at = now()
  where landing_id = v_landing_id
    and (id = p_campaign_id or status = 'active');

  update landings set is_active = true where id = v_landing_id;
end;
$$;

-- mover_landing_y_activar: mismo agregado que activar_campana de arriba.
create or replace function mover_landing_y_activar(p_campaign_id uuid, p_landing_id_nuevo uuid, p_activated_by uuid)
returns void
language plpgsql
as $$
declare
  v_landing_id_origen uuid;
begin
  select landing_id into v_landing_id_origen
  from campaigns
  where id = p_campaign_id;

  if v_landing_id_origen is null then
    raise exception 'No se encontró la campaña a mover.';
  end if;

  perform 1 from campaigns
  where landing_id in (v_landing_id_origen, p_landing_id_nuevo)
  order by landing_id, id
  for update;

  update campaigns
  set status = 'paused', deactivated_at = now(), updated_at = now()
  where landing_id = p_landing_id_nuevo
    and status = 'active'
    and id <> p_campaign_id;

  update campaigns
  set landing_id = p_landing_id_nuevo,
      status = 'active',
      activated_by = p_activated_by,
      activated_at = coalesce(activated_at, now()),
      deactivated_at = null,
      updated_at = now()
  where id = p_campaign_id;

  update landings set is_active = true where id = p_landing_id_nuevo;
end;
$$;

-- ── La cola de ventas para revisar ──────────────────────────────────
-- `marca_temporal` es la clave natural de dedupe: el timestamp propio
-- de cada respuesta del formulario de ventas (único a nivel de
-- segundo, generado por Google Forms) — el webhook manda la planilla
-- ENTERA en cada corrida, así que sin esto se re-insertaría todo cada
-- vez. `raw` guarda la fila cruda completa (para poder auditar/debuggear
-- qué llegó, más allá de los campos que sí sabemos interpretar hoy).
create table ventas (
  id uuid primary key default gen_random_uuid(),
  marca_temporal timestamptz not null unique,
  nombre text,
  apellido text,
  dni text,
  email text,
  celular text,
  programa text,
  origen text,
  monto text,
  raw jsonb not null default '{}',
  -- Confirmado (se completa recién al revisar) vs sugerido (lo que
  -- propuso el matcheo automático al ingerir) — dos columnas separadas
  -- a propósito: la sugerencia queda de rastro aunque Facundo elija
  -- otra campaña a mano, útil para ver más adelante qué tan bien
  -- funciona el matcheo automático.
  lead_id uuid references leads(id),
  campaign_id uuid references campaigns(id),
  lead_id_sugerido uuid references leads(id),
  campaign_id_sugerido uuid references campaigns(id),
  senales jsonb not null default '[]',
  estado text not null default 'pendiente' check (estado in ('pendiente', 'confirmada', 'rechazada')),
  creado_en timestamptz not null default now(),
  revisado_en timestamptz,
  revisado_por uuid
);

create index ventas_estado_idx on ventas (estado);
create index ventas_lead_id_idx on ventas (lead_id) where lead_id is not null;
create index ventas_campaign_id_idx on ventas (campaign_id) where campaign_id is not null;

-- Búsqueda de leads por teléfono, comparando solo los últimos N dígitos
-- (2026-09-01, pedido explícito: "entenderá las múltiples combinaciones
-- de celulares... 0549 o 11 o 381") — normaliza sacando todo lo que no
-- sea dígito de `leads.phone` (que se guarda como texto libre, sin
-- formato fijo) y compara el sufijo contra el que ya viene normalizado
-- desde el llamador (lib/ventas-matching.ts). `stable` porque no
-- escribe nada — permite que Postgres optimice si se llama más de una
-- vez con el mismo argumento dentro de la misma transacción.
create or replace function buscar_leads_por_telefono(p_sufijo text)
returns table(id uuid, campaign_id uuid)
language sql
stable
as $$
  select l.id, l.campaign_id
  from leads l
  where l.phone is not null
    and length(p_sufijo) >= 6
    and right(regexp_replace(l.phone, '\D', '', 'g'), length(p_sufijo)) = p_sufijo
  limit 5;
$$;

-- ── Confirmar / rechazar una venta de la cola ───────────────────────
-- confirmar_venta hace DOS cosas en una sola transacción: deja rastro
-- de la decisión en `ventas` (a qué lead/campaña quedó atribuida, quién
-- y cuándo) Y aplica el efecto real (marca vendido, cancela lo
-- 'pending' de ESE lead en TODAS sus campañas — mismo criterio global
-- que marcar_lead_vendido de la migración 0034: haber comprado algo
-- frena todo el goteo, no solo el de la campaña a la que se atribuye
-- esta venta puntual, que es un dato de analítica, no de a quién
-- seguir mandándole cosas).
create or replace function confirmar_venta(p_venta_id uuid, p_lead_id uuid, p_campaign_id uuid, p_revisado_por uuid)
returns jsonb
language plpgsql
as $$
declare
  v_ya_estaba boolean;
begin
  update ventas
  set estado = 'confirmada',
      lead_id = p_lead_id,
      campaign_id = p_campaign_id,
      revisado_en = now(),
      revisado_por = p_revisado_por
  where id = p_venta_id and estado = 'pendiente';

  if not found then
    return jsonb_build_object('error', 'no_pendiente');
  end if;

  select vendido_at is not null into v_ya_estaba from leads where id = p_lead_id;
  update leads set vendido_at = now() where id = p_lead_id and vendido_at is null;
  update email_sends set status = 'skipped' where lead_id = p_lead_id and status = 'pending';

  return jsonb_build_object('ok', true, 'ya_estaba', coalesce(v_ya_estaba, false));
end;
$$;

create or replace function rechazar_venta(p_venta_id uuid, p_revisado_por uuid)
returns jsonb
language plpgsql
as $$
begin
  update ventas
  set estado = 'rechazada', revisado_en = now(), revisado_por = p_revisado_por
  where id = p_venta_id and estado = 'pendiente';

  if not found then
    return jsonb_build_object('error', 'no_pendiente');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;
