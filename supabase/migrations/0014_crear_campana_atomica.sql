-- Bug real confirmado (2026-08-24) — createCampaign (ver
-- app/admin/(dashboard)/campaigns/actions.ts) insertaba `campaigns` y,
-- en una llamada HTTP SEPARADA, los `landing_email_steps`. Si el
-- primer insert tenía éxito pero el segundo fallaba (timeout de red,
-- blip transitorio de Supabase), quedaba una campaña real persistida en
-- 'draft' con CERO pasos de email — violando la regla de negocio de que
-- el paso 1 es obligatorio — sin que ningún constraint de la base ni
-- activar_campana() lo detectara. Si un admin activaba esa campaña sin
-- notar el problema, cualquier lead que capturara a partir de ahí no
-- recibía ningún email, sin ningún error visible en todo el flujo
-- público ni del panel.
--
-- Fix en dos partes:
--
--   1) crear_campana_con_pasos junta el insert de `campaigns` y el de
--      `landing_email_steps` en un único statement de Postgres (mismo
--      patrón que activar_campana en 0009_activar_campana_atomica.sql)
--      — todo o nada: si el insert de pasos falla, Postgres deshace
--      también el insert de la campaña, no queda nada persistido a
--      medias. Reemplaza los dos `.insert()` sueltos de createCampaign.
--
--   2) activar_campana (create or replace, mismo cuerpo que 0009 más
--      el chequeo nuevo) pasa a rechazar activar una campaña sin ningún
--      landing_email_steps activo — red de seguridad aparte, para
--      cualquier campaña que haya quedado stepless por este bug ANTES
--      de este fix (datos ya persistidos) o por cualquier otra vía que
--      no sea createCampaign.

create or replace function crear_campana_con_pasos(
  p_landing_id uuid,
  p_name text,
  p_category_id uuid,
  p_advisor_name text,
  p_whatsapp_number text,
  p_whatsapp_message text,
  p_variables jsonb,
  p_pasos jsonb -- array de {step_number, email_template_id, offset_days, subject, content}
)
returns uuid
language plpgsql
as $$
declare
  v_campaign_id uuid;
begin
  insert into campaigns (
    landing_id, name, category_id, status,
    advisor_name, whatsapp_number, whatsapp_message, variables
  )
  values (
    p_landing_id, p_name, p_category_id, 'draft',
    p_advisor_name, p_whatsapp_number, p_whatsapp_message, coalesce(p_variables, '{}'::jsonb)
  )
  returning id into v_campaign_id;

  -- Si esta segunda inserción falla (constraint, tipo de dato, lo que
  -- sea), la excepción deshace TODA la función — incluido el insert de
  -- campaigns de arriba. Ya no puede quedar una campaña sin sus pasos.
  insert into landing_email_steps (campaign_id, step_number, email_template_id, offset_days, subject, content)
  select v_campaign_id, x.step_number, x.email_template_id, x.offset_days, x.subject, x.content
  from jsonb_to_recordset(p_pasos) as x(
    step_number int,
    email_template_id uuid,
    offset_days int,
    subject text,
    content text
  );

  return v_campaign_id;
end;
$$;

-- Mismo cuerpo que activar_campana en 0009_activar_campana_atomica.sql
-- (lock ordenado de todas las campañas de la landing, tomado antes de
-- leer o validar nada), con un único chequeo nuevo agregado después de
-- validar el status: sin al menos un landing_email_steps activo, no hay
-- nada que mandarle a un lead que caiga en esta campaña — activarla
-- sería repetir el mismo agujero que crear_campana_con_pasos tapa
-- arriba, pero para una campaña que ya haya quedado stepless de antes.
create or replace function activar_campana(p_campaign_id uuid)
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

  if not exists (
    select 1 from landing_email_steps
    where campaign_id = p_campaign_id and is_active = true
  ) then
    raise exception 'No se puede activar: esta campaña no tiene ningún paso de email cargado.';
  end if;

  update campaigns
  set status = case when id = p_campaign_id then 'active' else 'paused' end,
      updated_at = now()
  where landing_id = v_landing_id
    and (id = p_campaign_id or status = 'active');

  update landings set is_active = true where id = v_landing_id;
end;
$$;
