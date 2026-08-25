-- Dos bugs reales confirmados en app/api/leads/route.ts (2026-08-24),
-- corregidos juntos en esta migración porque comparten el mismo punto
-- de entrada (el POST público, sin sesión, con service role).
--
-- ── Bug 1 (alta) — sin rate limiting ───────────────────────────────
-- El POST público no tenía ningún freno: un atacante que scrapea
-- cualquier landing (el landing_id va en el HTML como campo oculto
-- {{__landing_id__}}) podía scriptear miles de POST con el email de una
-- víctima real, y cada uno agenda filas reales en email_sends que
-- process-pending.ts despacha por Brevo sin ningún opt-in — email
-- bombing sobre la víctima y/o degradación de la reputación de envío
-- del dominio de Escencial por volumen no solicitado. No había 429, ni
-- CAPTCHA, ni honeypot.
--
-- ── Bug 2 (media) — la respuesta es un oráculo de duplicado ────────
-- `{ ok:true, duplicado:true }` vs `{ ok:true, lead_id }` le dice a
-- cualquiera, sin autenticarse, si un email puntual ya se anotó en una
-- campaña puntual. Sin rate limiting (bug 1), se puede iterar una lista
-- de emails candidatos contra un landing_id conocido y armar ese mapa.
-- El flag `duplicado` se deja intacto en la respuesta a propósito —
-- HTML_BASE.../HTML_BASE_ENVIO_PERSONALIZADO (lib/landing-template-defaults.ts)
-- lo usan para mostrarle al visitante "ya estabas registrado" en vez de
-- "gracias", y esas plantillas quedan fuera del alcance de este fix
-- puntual. El rate limiting de acá abajo (sobre todo el de
-- email+landing) es la mitigación real: capa drásticamente cuántos
-- emails se pueden probar por minuto/día contra una landing dada.
--
-- rate_limit_events guarda cada intento de POST con una clave (IP o
-- email, según kind) y se cuenta con ventana deslizante desde el
-- handler antes de tocar `leads`. landing_id NO es una FK a propósito:
-- un landing_id inventado (el caso típico de un atacante probando ids
-- al voleo) no puede romper el chequeo de rate limit con un error de
-- constraint — el chequeo tiene que poder correr ANTES de saber si la
-- landing existe de verdad.
create table rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('ip', 'email')),
  key text not null,
  landing_id uuid not null,
  created_at timestamptz not null default now()
);

-- Sirve las dos consultas del handler: kind='ip' + key=ip (sin filtrar
-- landing_id — el freno por IP es global, cruza landings, para que un
-- atacante no lo esquive repartiendo el mismo volumen entre varios
-- landing_id reales) y kind='email' + key=email + landing_id=X (sí
-- filtrado por landing, para no bloquear a alguien que legítimamente
-- se anota en más de una campaña real distinta).
create index rate_limit_events_lookup_idx
  on rate_limit_events (kind, key, landing_id, created_at desc);

alter table rate_limit_events enable row level security;

-- ── Bug 3 ([?], confirmado) — insert de lead + agendado de email_sends
-- sin transacción ─────────────────────────────────────────────────
-- app/api/leads/route.ts hacía el insert en `leads` y el/los insert(s)
-- en `email_sends` como escrituras HTTP separadas. Si el segundo
-- fallaba (ej. un admin borra un paso de landing_email_steps —
-- updateCampaign hace DELETE de los pasos sobrantes— justo mientras un
-- lead está mandando el formulario, y el array `steps` que ya traía la
-- request queda con un id que dejó de existir), Postgres rechaza el
-- INSERT completo de email_sends por violar la FK — pero el lead ya
-- había quedado insertado en un statement previo y separado. La
-- respuesta era ok:true, el lead se guardaba, y CERO emails quedaban
-- agendados, sin que nadie se enterara más que un console.error en
-- logs de servidor. En la rama de re-registro (email ya existía) el
-- efecto era peor: se borraban los email_sends viejos no enviados y
-- RECIÉN DESPUÉS se insertaba el nuevo — si ese insert fallaba, el
-- lead pasaba de tener algo agendado a tener cero filas, en silencio.
--
-- registrar_lead junta TODO (insert de leads, o el camino de
-- duplicado con su reprogramación) en una única función de Postgres —
-- mismo patrón que activar_campana/crear_campana_con_pasos (0009,
-- 0014): todo o nada. Si el insert de email_sends falla, la excepción
-- deshace también el insert de leads (o el delete+insert de
-- reprogramación) — nunca queda un lead huérfano ni una reprogramación
-- a medias. app/api/leads/route.ts pasa a llamar esta función en vez
-- de hacer los inserts sueltos; si la función tira una excepción, la
-- respuesta pasa a ser ok:false (antes hubiera sido ok:true con el
-- lead huérfano).
--
-- Los pasos activos se leen DE NUEVO acá adentro, en la misma
-- transacción del insert — no se reutiliza el array `steps` que
-- route.ts ya había leído antes (ese queda solo para el chequeo previo
-- de "esta opción existe", una validación de UX, un 400 más claro que
-- el error genérico de acá). Con la lectura fresca, un paso borrado a
-- último momento simplemente ya no aparece en el SELECT — no hay forma
-- de terminar con un landing_email_step_id colgante, ni falta ningún
-- DELETE compensatorio: la fila jamás llega a persistir.
create or replace function registrar_lead(
  p_campaign_id uuid,
  p_email text,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_selected_option int,
  p_envio_personalizado boolean
)
returns jsonb
language plpgsql
as $$
declare
  v_lead_id uuid;
  v_created_at timestamptz;
  v_lead_existente_id uuid;
  v_lead_existente_selected_option int;
  v_ya_envio_exito boolean;
  v_paso_correcto_id uuid;
begin
  begin
    insert into leads (campaign_id, email, first_name, last_name, phone, selected_option)
    values (
      p_campaign_id, p_email, p_first_name, p_last_name, nullif(p_phone, ''),
      case when p_envio_personalizado then p_selected_option else null end
    )
    returning id, created_at into v_lead_id, v_created_at;

    if p_envio_personalizado then
      -- Envío personalizado: solo el paso cuyo step_number coincide con
      -- la opción elegida, siempre inmediato (scheduled_for = el propio
      -- momento de captura) — mismo criterio que tenía route.ts.
      insert into email_sends (lead_id, landing_email_step_id, scheduled_for, status)
      select v_lead_id, les.id, v_created_at, 'pending'
      from landing_email_steps les
      where les.campaign_id = p_campaign_id
        and les.is_active = true
        and les.step_number = p_selected_option;
    else
      -- Goteo normal: todos los pasos activos, cada uno con su propio
      -- offset_days sumado al momento de captura.
      insert into email_sends (lead_id, landing_email_step_id, scheduled_for, status)
      select v_lead_id, les.id, v_created_at + (les.offset_days || ' days')::interval, 'pending'
      from landing_email_steps les
      where les.campaign_id = p_campaign_id
        and les.is_active = true;
    end if;

    return jsonb_build_object('es_duplicado', false, 'lead_id', v_lead_id, 'created_at', v_created_at);
  exception when unique_violation then
    -- Constraint leads_campaign_email_unique_idx (campaign_id, lower(email))
    -- ya disparó -> este lead ya estaba registrado en esta campaña.
    -- Comparación por igualdad exacta sobre lower(email), no ilike: a
    -- diferencia del código viejo (bugfix 2026-08-24 con ilike escapado),
    -- acá '%'/'_' del email nunca se interpretan como comodín porque no
    -- hay comodín involucrado.
    select id, selected_option into v_lead_existente_id, v_lead_existente_selected_option
    from leads
    where campaign_id = p_campaign_id and lower(email) = lower(p_email)
    for update;

    if not p_envio_personalizado then
      return jsonb_build_object('es_duplicado', true, 'lead_id', v_lead_existente_id);
    end if;

    -- Solo se considera "ya cubierto" si existe un envío realmente
    -- 'sent' — cualquier otro estado (pending, processing huérfano,
    -- error, skipped) permite reprogramar de nuevo.
    select exists(
      select 1 from email_sends where lead_id = v_lead_existente_id and status = 'sent'
    ) into v_ya_envio_exito;

    -- Variable ESCALAR (uuid), no record: si esta select no encuentra
    -- fila (la opción elegida no tiene un paso activo cargado — el
    -- caso concreto que describe el bug de arriba), v_paso_correcto_id
    -- queda en NULL sin más. Con `record` en vez de uuid, referenciar
    -- v_paso_correcto.id en ese caso tira "record is not assigned yet"
    -- en vez de comportarse como "no hay paso, no reprogramar nada".
    select id into v_paso_correcto_id
    from landing_email_steps
    where campaign_id = p_campaign_id and is_active = true and step_number = p_selected_option;

    if not v_ya_envio_exito and v_paso_correcto_id is not null then
      if v_lead_existente_selected_option is distinct from p_selected_option then
        update leads set selected_option = p_selected_option where id = v_lead_existente_id;
      end if;

      -- Mismo orden que antes (borrar lo viejo no-enviado, insertar lo
      -- nuevo) pero ahora dentro de la MISMA transacción: si el insert
      -- de abajo fallara, la excepción deshace también este delete —
      -- los email_sends viejos quedan intactos, nunca en cero.
      delete from email_sends
      where lead_id = v_lead_existente_id
        and status <> 'sent';

      insert into email_sends (lead_id, landing_email_step_id, scheduled_for, status)
      values (v_lead_existente_id, v_paso_correcto_id, now(), 'pending');
    end if;

    return jsonb_build_object('es_duplicado', true, 'lead_id', v_lead_existente_id);
  end;
end;
$$;
