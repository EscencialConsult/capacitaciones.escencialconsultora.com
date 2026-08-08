# Armar la planilla de Google Sheets (una sola pestaña)

Creá una planilla nueva y **una sola pestaña**, llamada exactamente `Datos`
(el código la busca por ese nombre literal).

Adentro de esa pestaña hay **dos bloques de columnas** que conviven en la
misma fila 1 de encabezados, separados por una columna vacía:

| Rango | Bloque | Quién lo llena |
|---|---|---|
| `A:Q` | **Leads** — una fila por persona que entra a la landing | Lo escribe el código solo (Script A / Script C) |
| `R` | *(vacía, separador visual)* | Nadie — dejarla en blanco |
| `S:AM` | **Config_Campañas** — una fila por campaña | Lo cargás vos a mano |

Por qué dos bloques y no todo junto: Leads crece con cada persona que se
anota, Config_Campañas crece con cada campaña que armás (mucho más lento).
Mantenerlos en columnas separadas de la misma pestaña te permite editar un
template o un timing **una sola vez** en su fila de campaña, sin tener que
tocar cada lead uno por uno.

## Fila de encabezados — pegar tal cual en la celda A1

Es una sola fila que cubre las columnas A hasta AM (39 columnas en total,
separadas por tabulador — al pegar en A1, Sheets las reparte solas en columnas):

```
lead_id	timestamp	origen_campaña	nombre	apellido	email	datos_extra	fecha_envio_1	estado_1	fecha_envio_2	estado_2	fecha_envio_3	estado_3	fecha_envio_4	estado_4	contacto_confirmado_fecha	contacto_confirmado_paso		origen_campaña	asesora_nombre	asesora_whatsapp	mensaje_whatsapp	offset_dias_1	template_base_1	contenido_1	asunto_1	offset_dias_2	template_base_2	contenido_2	asunto_2	offset_dias_3	template_base_3	contenido_3	asunto_3	offset_dias_4	template_base_4	contenido_4	asunto_4	activa
```

Si al pegar no se separa en columnas: `Edición > Pegado especial > Solo
valores`, o pegalo y después `Datos > Dividir texto en columnas`
(separador: tabulación).

## Verificación rápida de columnas

Después de pegar, confirmá que quedó así (podés congelar la fila 1 con
`Ver > Congelar > 1 fila` para no perderla de vista):

| Columna | Campo |
|---|---|
| A | `lead_id` |
| B | `timestamp` |
| C | `origen_campaña` |
| ... | (hasta Q: `contacto_confirmado_paso`) |
| R | *(vacía)* |
| S | `origen_campaña` |
| T | `asesora_nombre` |
| U | `asesora_whatsapp` |
| V | `mensaje_whatsapp` |
| W–Z | `offset_dias_1` / `template_base_1` / `contenido_1` / `asunto_1` |
| AA–AD | paso 2 |
| AE–AH | paso 3 |
| AI–AL | paso 4 |
| AM | `activa` |

## Fila de prueba para Config_Campañas (bloque S:AM, fila 2)

| Columna | Valor |
|---|---|
| `origen_campaña` (S2) | `campaña_prueba_ago26` |
| `asesora_nombre` (T2) | `Nombre Asesora` |
| `asesora_whatsapp` (U2) | `5493815551234` |
| `mensaje_whatsapp` (V2) | `Hola, quiero info sobre la campaña` |
| `offset_dias_1` (W2) | `0` |
| `template_base_1` (X2) | *(URL del template — ver checklist-implementacion.md)* |
| `contenido_1` (Y2) | `Gracias por tu interés. Un asesor se va a contactar a la brevedad.` |
| `asunto_1` (Z2) | `Recibimos tu consulta` |
| pasos 2 a 4 | dejar vacíos — el sistema los saltea solo (`estado_N = n/a`) |
| `activa` (AM2) | `TRUE` |

> `activa` tiene que ser el booleano `TRUE` de Sheets (no el texto "true" ni "Sí").
> El código acepta ambos formatos igual, pero así queda más prolijo.

## Sobre los errores de envío

No hay una tercera pestaña de "Logs" — quedaría raro sumar una tabla más
que también crece sin límite en la misma pestaña. Si un envío falla:

- El `estado_N` de esa fila de Leads queda en `error` (así sabés cuál lead/paso falló).
- El detalle del error queda en **Apps Script > Ejecuciones** (ícono de reloj
  a la izquierda del editor), que ya es un historial con fecha/hora sin que
  tengas que mantener nada en Sheets.

## Zona horaria

`Archivo > Configuración de la hoja de cálculo > Zona horaria` → poné
`(GMT-03:00) Argentina`. Tiene que coincidir con el `timeZone` del
`appsscript.json` del proyecto de Apps Script, si no los offsets de días
calculan mal.
