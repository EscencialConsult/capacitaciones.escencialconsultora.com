-- Modo de envío alternativo "por selección" (2026-08-24, pedido de
-- Facundo) — CONVIVE con el goteo de 4 pasos de siempre, nunca lo
-- reemplaza: las campañas que ya existen (DISC, Servicio Prueba, etc.,
-- con leads y envíos reales) siguen funcionando exactamente igual.
--
-- Una plantilla marcada envio_personalizado=true agrega un <select> al
-- formulario público donde el LEAD elige una opción 1 a 4 — el admin
-- carga los 4 emails una sola vez al armar la campaña (mismo mecanismo
-- de landing_email_steps de siempre), pero en vez de mandarle los 4 en
-- goteo por días, el sistema manda UN SOLO email — el que corresponde a
-- la opción que el lead eligió — al instante. Ver app/api/leads/route.ts
-- para la lógica de agendado condicional según este flag.
alter table landing_templates add column envio_personalizado boolean not null default false;

-- Qué opción (1-4) eligió el lead en el <select> del formulario, si la
-- plantilla es de envío personalizado — null para leads de campañas de
-- goteo normal (la gran mayoría hoy). Útil también para reportar qué
-- opción es la más elegida.
alter table leads add column selected_option smallint
  check (selected_option is null or selected_option between 1 and 4);
