-- Subdominio propio por landing (2026-08-31, pedido explícito) — el
-- link de una landing pasa a poder ser slug.escencialconsultora.com,
-- además del clásico capacitaciones.escencialconsultora.com/slug (que
-- sigue funcionando siempre, ver app/[slug]/route.ts, sin cambios).
-- Ver lib/dominio-landing.ts para la orquestación real (Hostinger DNS +
-- Netlify domain alias).
--
-- subdominio_publicado_en: cuándo se confirmó la última publicación
-- exitosa (null = nunca se publicó). subdominio_error: mensaje del
-- último intento fallido (null = sin error pendiente, se limpia solo en
-- el próximo intento exitoso) — se guarda acá y no se recalcula en cada
-- carga de /admin/landings para no depender de una API externa (Hostinger/
-- Netlify) solo para mostrar la lista.
alter table landings add column subdominio_publicado_en timestamptz;
alter table landings add column subdominio_error text;
