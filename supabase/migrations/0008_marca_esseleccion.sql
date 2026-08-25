-- Amplía el check constraint de landing_templates.marca para permitir
-- la nueva marca fija "esseleccion" (Selección) — logos reales subidos
-- por Facundo a public/logos/esseleccion/ el 2026-08-24, paleta y
-- tipografía sacadas directo del HTML real que va a subir (ver
-- lib/landing-template-defaults.ts → MARCAS.esseleccion). Nombre del
-- constraint confirmado contra la base real antes de escribir esto.
alter table landing_templates drop constraint landing_templates_marca_check;
alter table landing_templates add constraint landing_templates_marca_check
  check (marca is null or marca in ('one', 'escencial-latam', 'escencial-argentina', 'esseleccion'));
