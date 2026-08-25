-- Mover "categoría" de Plantilla/Landing a Campaña.
--
-- Hasta acá category_id vivía en landing_templates (desde 0001_init) Y
-- en landings (agregado en 0004, nunca llegó a usarse de verdad — las 4
-- landings reales tienen category_id null hoy). Facundo pidió que la
-- categoría se elija en Campaña en cambio: una misma Landing/Plantilla
-- puede reusarse para campañas de distinto rubro a lo largo del tiempo,
-- así que "categoría" describe mejor a la tanda de marketing puntual
-- que al diseño reutilizable o al link en sí.
--
-- Backfill: los 3 landing_templates reales SÍ tienen category_id
-- cargado ("Servicios" los tres, verificado contra la base real antes
-- de escribir esto) — se preserva ese dato copiándolo a la campaña de
-- cada landing que use esa plantilla, en vez de perderlo silenciosamente
-- al dropear la columna.
alter table campaigns add column category_id uuid references landing_categories(id);

update campaigns c
set category_id = lt.category_id
from landings l
join landing_templates lt on lt.id = l.template_id
where l.id = c.landing_id;

alter table landing_templates drop column category_id;
alter table landings drop column category_id;
