-- Bug real confirmado (2026-08-24) — activar una campaña (o moverle la
-- landing_id a una que ya está activa en otro lado) hacía el
-- select-pausar-activar en TRES llamadas HTTP separadas desde
-- actions.ts, cada una su propia transacción. Una activación
-- concurrente de OTRA campaña de la MISMA landing podía colarse justo
-- en el medio y pisar en silencio lo que la primera acababa de activar
-- — ningún admin veía error, el índice único
-- campaigns_one_active_per_landing_idx no detecta nada porque en cada
-- escritura individual nunca hay más de una fila activa a la vez.
--
-- Estas dos funciones mueven TODA la transición (leer, pausar lo viejo,
-- activar lo nuevo, prender la landing) a un único statement de
-- Postgres — atómico por diseño — y usan `for update` para bloquear
-- las campañas de la landing en cuestión, así que una segunda
-- activación/movimiento concurrente hacia esa misma landing queda
-- esperando a que la primera termine en vez de pisarla.
--
-- Ronda 3 (2026-08-24) — tres bugs más, verificados por 3 escépticos
-- independientes, corregidos en esta misma migración (todavía sin
-- aplicar a la base real):
--
--   1) mover_landing_y_activar no bloqueaba la fila de la campaña que
--      mueve hasta el final, ni forzaba status='active' — dependía de
--      un SELECT sin `for update` hecho por separado en actions.ts
--      (otro round-trip HTTP, fuera de esta transacción). Una
--      activar_campana concurrente sobre la landing de ORIGEN podía
--      pausar esa campaña justo en la ventana entre ese SELECT y este
--      RPC, y la función igual la movía dejándola 'paused' — la landing
--      destino quedaba is_active=true pero sin ninguna campaña activa,
--      así que app/[slug]/route.ts devolvía 404 sin que ningún admin
--      viera un error en ningún paso del flujo.
--
--   2) Dos mover_landing_y_activar concurrentes que intercambian
--      campañas entre sí (mover C1 de L1→L2 mientras otro admin mueve
--      C2 de L2→L1) podían deadlockear: cada llamada bloqueaba primero
--      TODAS las filas de su landing DESTINO (sin saberlo, incluía la
--      campaña que la otra llamada estaba por mover) y recién al final
--      pedía el lock puntual de esa fila — que había quedado en manos
--      de la otra transacción. Circular wait clásico.
--
--   3) activar_campana (y mover_landing_y_activar) bloqueaban en DOS
--      pasos separados — primero la fila puntual por id, después un
--      `for update` más amplio sobre el resto de las campañas de la
--      landing — en vez de un único lock ordenado. Dos llamadas
--      concurrentes sobre DOS campañas distintas de la MISMA landing
--      (ej. activar A y activar B casi al mismo tiempo) podían
--      deadlockear en vez de encolarse como promete el comentario de
--      arriba: llamada 1 se queda con el lock puntual de A, llamada 2
--      con el de B, y cuando cada una pide el lock amplio de "toda la
--      landing" necesita la fila que tiene la otra.
--
-- El fix para los tres es el mismo patrón: un ÚNICO statement de lock,
-- con orden estable (`order by id`, o `order by landing_id, id` cuando
-- hay dos landings en juego), adquirido ANTES de leer o validar nada.
-- Con un solo lock ordenado, dos llamadas concurrentes siempre piden
-- los locks en la misma secuencia y una simplemente espera a la otra
-- — no hay forma de que se armen dos mitades de un ciclo.

create or replace function activar_campana(p_campaign_id uuid)
returns void
language plpgsql
as $$
declare
  v_landing_id uuid;
  v_status text;
begin
  -- Lectura sin lock, solo para saber a qué landing pertenece esta
  -- campaña. El lock de verdad se toma en el siguiente paso, en un
  -- ÚNICO statement que cubre TODAS las campañas de esa landing a la
  -- vez — ya no en dos pasos separados (fila puntual + resto de la
  -- landing), que era justo lo que permitía el deadlock de la Ronda 3
  -- entre dos activaciones concurrentes de campañas distintas de la
  -- misma landing.
  select landing_id into v_landing_id
  from campaigns
  where id = p_campaign_id;

  if v_landing_id is null then
    raise exception 'No se encontró la campaña.';
  end if;

  -- Bloqueamos TODAS las campañas de esta landing en un único
  -- statement, ordenadas por id — así, sin importar qué campaña de la
  -- landing esté activando cada llamada concurrente, todas piden los
  -- locks en la MISMA secuencia y una simplemente espera a la otra en
  -- vez de deadlockear.
  perform 1 from campaigns where landing_id = v_landing_id order by id for update;

  -- Recién con el lock tomado leemos el estado real para validar —
  -- si esta campaña esperó el lock, acá vemos su estado ya actualizado,
  -- no el que tenía cuando arrancó la función.
  select status into v_status from campaigns where id = p_campaign_id;

  if v_status not in ('draft', 'paused') then
    raise exception 'Solo se puede activar una campaña que esté en borrador o pausada.';
  end if;

  update campaigns
  set status = case when id = p_campaign_id then 'active' else 'paused' end,
      updated_at = now()
  where landing_id = v_landing_id
    and (id = p_campaign_id or status = 'active');

  update landings set is_active = true where id = v_landing_id;
end;
$$;

-- Mismo patrón que activar_campana, para la rama de updateCampaign que
-- reasigna landing_id a una campaña que ya estaba 'active' (moverla es,
-- en los hechos, una reactivación en la landing destino). No toca el
-- resto de las columnas de la campaña — eso lo sigue haciendo el UPDATE
-- normal desde actions.ts justo después.
create or replace function mover_landing_y_activar(p_campaign_id uuid, p_landing_id_nuevo uuid)
returns void
language plpgsql
as $$
declare
  v_landing_id_origen uuid;
begin
  -- Landing de origen de la campaña que se mueve — lectura sin lock,
  -- solo para saber qué dos landings entran en juego. El lock de
  -- verdad viene en el siguiente paso, ya con origen y destino juntos.
  select landing_id into v_landing_id_origen
  from campaigns
  where id = p_campaign_id;

  if v_landing_id_origen is null then
    raise exception 'No se encontró la campaña a mover.';
  end if;

  -- Bloqueamos TODAS las campañas de AMBAS landings (origen y
  -- destino) en un único statement, ordenadas por landing_id e id —
  -- eliminamos así la asimetría origen/destino que tenía la versión
  -- anterior (que bloqueaba primero destino entero y recién al final
  -- pedía el lock puntual de la campaña, en su landing de origen).
  -- Con un orden de adquisición idéntico sin importar cuál de las dos
  -- landings sea "origen" y cuál "destino" para cada llamada, dos
  -- movimientos cruzados entre las mismas dos landings se serializan
  -- en vez de deadlockear (Ronda 3).
  perform 1 from campaigns
  where landing_id in (v_landing_id_origen, p_landing_id_nuevo)
  order by landing_id, id
  for update;

  update campaigns
  set status = 'paused', updated_at = now()
  where landing_id = p_landing_id_nuevo
    and status = 'active'
    and id <> p_campaign_id;

  -- Forzamos status='active' acá explícitamente — no alcanza con
  -- asumir que la campaña "ya estaba activa" porque eso fue lo que vio
  -- actions.ts en un SELECT suelto, sin `for update` y en un round-trip
  -- HTTP separado de este RPC. En esa ventana, una activar_campana
  -- concurrente sobre la landing de ORIGEN pudo haber pausado esta
  -- misma campaña; al forzar 'active' acá, el resultado final queda
  -- garantizado — esta campaña termina activa en la landing nueva —
  -- sin importar qué pasó mientras tanto (Ronda 3, bug 1).
  update campaigns
  set landing_id = p_landing_id_nuevo, status = 'active', updated_at = now()
  where id = p_campaign_id;

  update landings set is_active = true where id = p_landing_id_nuevo;
end;
$$;
