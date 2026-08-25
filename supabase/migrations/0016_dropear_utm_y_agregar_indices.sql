-- Estos cambios habían quedado editados directo en 0001_init.sql (ya
-- aplicada hace tiempo a la base real — ver _claude_migrations) en vez
-- de ir en un archivo nuevo. GitHub Integration/apply-migrations.js
-- corren cada archivo de supabase/migrations/ UNA sola vez y llevan
-- registro de qué ya se aplicó — nunca vuelven a correr 0001 solo
-- porque el contenido del archivo cambió. Verificado en vivo contra la
-- base real antes de escribir esto (select column_name from
-- information_schema.columns where table_name = 'leads'; select
-- indexname from pg_indexes where tablename in ('landings','leads',
-- 'email_sends')): las columnas de abajo TODAVÍA existen y los 4
-- índices TODAVÍA no. También se confirmó que ninguno de los 4 leads
-- reales tiene datos en extra/utm_source/utm_medium/utm_campaign (todas
-- en su default), así que el drop no pierde nada.

-- template_id se consulta por igualdad en templates/actions.ts (contarCampanasConectadas,
-- deleteTemplate) cada vez que se abre o guarda una plantilla. Sin índice, cada llamada
-- escanea toda la tabla landings.
create index landings_template_id_idx on landings (template_id);

-- Sin columnas de atribución (utm_source/medium/campaign, extra): ningún
-- formulario ni endpoint del proyecto las llena, así que quedarían null
-- para siempre. Si en algún momento se arma tracking de campaña real, se
-- agregan en una migración nueva junto con el código que las capture.
alter table leads
  drop column extra,
  drop column utm_source,
  drop column utm_medium,
  drop column utm_campaign;

-- El dashboard admin ordena TODA la tabla por created_at en cada carga
-- (app/admin/(dashboard)/page.tsx: leads recientes + conteo de los últimos 7 días).
create index leads_created_at_idx on leads (created_at desc);

-- lead_id arma el embed de la pantalla "Ver leads" de cada campaña
-- (leads(...).select('..., email_sends(...)')) — sin índice, PostgREST
-- hace sequential scan de toda email_sends en cada carga de esa pantalla.
create index email_sends_lead_id_idx on email_sends (lead_id);

-- landing_email_step_id es FK sin ON DELETE (RESTRICT): Postgres escanea
-- toda email_sends para chequear el constraint cada vez que se borra un
-- landing_email_step vacío (updateCampaign) o se borra una campaña entera
-- (deleteCampaign), no solo cuando el borrado falla.
create index email_sends_landing_email_step_id_idx on email_sends (landing_email_step_id);
