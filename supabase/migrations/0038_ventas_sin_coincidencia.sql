-- "sin_coincidencia" como estado propio (2026-09-01, pedido explícito:
-- "si el sistema no detecta matcheo con ninguno de mis leads, no
-- debería mostrármelo como notificación, ya que son gente que compró
-- desde otros medios") — hasta ahora TODA venta ingerida entraba como
-- 'pendiente', tenga o no una sugerencia. Eso inflaba el badge del
-- sidebar y la cola de revisión con filas que no tienen nada que
-- revisar (nadie de nuestros leads compró eso, es tráfico de otro
-- canal) — confirmado con datos reales: las primeras 285 ventas
-- ingeridas (todas de junio/julio, antes de que existiera ningún lead
-- real) tenían 0 señales cada una.
--
-- Separar el estado en vez de simplemente no insertar la fila: se
-- sigue guardando el dato (por si el matcheo automático se equivocó y
-- en verdad SÍ es un lead nuestro, revisable a mano más adelante si
-- hace falta) pero deja de contar como "pendiente" — el sidebar, la
-- analítica y la cola de revisión ya filtran por estado='pendiente' en
-- todos lados, así que este solo cambio alcanza sin tocar ninguna
-- consulta.
alter table ventas drop constraint ventas_estado_check;
alter table ventas add constraint ventas_estado_check
  check (estado in ('pendiente', 'sin_coincidencia', 'confirmada', 'rechazada'));

-- Backfill de lo ya ingerido (2026-09-01) — las 285 filas actuales sin
-- ninguna señal, para que el badge baje ya mismo en vez de recién con
-- la próxima corrida del sync.
update ventas set estado = 'sin_coincidencia'
where estado = 'pendiente' and jsonb_array_length(senales) = 0;
