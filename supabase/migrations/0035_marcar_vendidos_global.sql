-- Sync automático de ventas (2026-08-31, pedido explícito: "debe ser
-- de un modo automático") — variante GLOBAL de marcar_vendidos_por_email
-- (migración 0034), sin acotar a una campaña puntual. El webhook que la
-- llama (app/api/ventas-sync/route.ts) recibe la planilla de ventas
-- completa desde un Apps Script, sin saber (ni tener por qué saber) en
-- qué campaña entró cada persona — así que busca ese email en TODOS
-- lados y cancela lo pendiente en cada campaña donde aparezca, no en
-- una sola. Coincide con cómo lo pidió Facundo: "no se le siga
-- enviando los emails de las campañas" (plural).
create or replace function marcar_vendidos_por_email_global(p_emails text[])
returns jsonb
language plpgsql
as $$
declare
  v_ids uuid[];
  v_marcados int;
  v_encontrados int;
begin
  select array_agg(id) into v_ids
  from leads
  where email is not null and lower(email) = any(p_emails);

  v_encontrados := coalesce(array_length(v_ids, 1), 0);

  with recien as (
    update leads set vendido_at = now()
    where id = any(v_ids) and vendido_at is null
    returning id
  )
  select count(*) into v_marcados from recien;

  update email_sends
  set status = 'skipped'
  where status = 'pending' and lead_id = any(v_ids);

  return jsonb_build_object('marcados', v_marcados, 'encontrados', v_encontrados);
end;
$$;
