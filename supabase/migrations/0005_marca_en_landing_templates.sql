-- Cada plantilla de landing puede pertenecer a una marca fija (ONE,
-- Escencial LATAM, Escencial Argentina, más adelante Selección) — el
-- prompt de generación de plantilla usa esto para fijar paleta de
-- colores, tipografía y logos exactos en vez de dejarlos "a elección"
-- (ver lib/landing-template-defaults.ts). Nullable a propósito: las
-- plantillas genéricas ya existentes (Modelo Genérico 1, Test de DISC,
-- Landing base — azul) no pertenecen a ninguna marca fija.
alter table landing_templates add column marca text
  check (marca is null or marca in ('one', 'escencial-latam', 'escencial-argentina'));
