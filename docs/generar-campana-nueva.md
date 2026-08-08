# Prompt para generar una campaña/landing nueva

Cada vez que quieras una landing nueva (o relanzar una existente con
cambios), copiá el bloque de abajo completo y pegáselo a la IA en un chat
nuevo — no hace falta que sea esta misma conversación. Trae toda la
estructura del sistema adentro, así cualquier sesión puede resolverlo sin
tener que re-explicar nada.

---

## Prompt — copiar desde acá

```
Necesito una landing nueva para el sistema de "Landing Automatizada con
Envío de Emails" (repo: capacitaciones.escencialconsultora.com). Antes de
generar nada, hacéme estas preguntas UNA POR UNA y esperá mi respuesta a
cada una antes de pasar a la siguiente:

1. Nombre de la campaña — se usa como origen_campaña. Tiene que ser en
   minúsculas, sin espacios ni acentos, palabras separadas por guion bajo,
   terminado en mes+año abreviado. Ejemplo bueno: liquidacion_ago26.
   ¿Cuál querés para esta?

2. Nombre y WhatsApp de la asesora asignada a esta campaña. El número va
   en formato internacional, sin + ni espacios ni guiones (ejemplo:
   5493815551234).

3. Para cada uno de los hasta 4 emails de seguimiento que quieras activar
   (podés usar 1, 2, 3 o los 4 — los que no uses se saltean solos):
   - Timing: "X días después de que la persona se registra" o una fecha
     puntual (se convierte a offset de días igual).
   - Asunto del email.
   - Contenido/speech de ese paso puntual.

4. Por último, pedime que te adjunte una imagen o diseño de referencia de
   cómo querés que se vea visualmente el formulario de la landing (colores,
   estilo, campos visibles). Si no tengo nada específico, decime que uso
   el mismo estilo que ya existe en index.html del repo.

Con esas respuestas, generame:

a) La fila lista para pegar en el bloque Config_Campañas de la pestaña
   "Datos" (columnas S:AM) — origen_campaña, asesora_nombre,
   asesora_whatsapp, mensaje_whatsapp, y los offset_dias_N / contenido_N /
   asunto_N que correspondan según lo que activé arriba, con activa=TRUE.
   template_base_N lo dejás vacío si no tengo un diseño de email nuevo
   para esa campaña (reuso el que ya existe).

b) Un archivo HTML de landing nuevo, basado en la estructura de index.html
   del repo (mismo POST vía URLSearchParams a WEBAPP_URL, mismo campo
   oculto origen_campaña con el valor del punto 1, mismos campos nombre/
   apellido/email/datos_extra), pero con el diseño visual que te haya
   pasado en el punto 4.

No toques Code.gs ni la estructura de columnas de Sheets — esta campaña
tiene que funcionar con el backend que ya existe, sin cambiar una línea
de Apps Script.
```

---

## Por qué está armado así

- **Una pregunta a la vez**: evita que termines completando 6 cosas de
  una y te olvides de alguna — mismo criterio que usamos acá.
- **Ejemplo de `origen_campaña` incluido**: es el campo que más rompe
  cosas si queda mal escrito (con espacios, tildes, mayúsculas
  inconsistentes) porque tiene que matchear EXACTO entre la landing y la
  fila de `Config_Campañas`.
- **El diseño va al final**: así primero se resuelve la lógica (qué
  campaña, qué timing, qué asesora) y el diseño no tapa lo importante.
- **Nunca toca `Code.gs` ni Sheets**: el prompt deja explícito que solo
  genera la fila de configuración y el HTML — la arquitectura de backend
  ya está resuelta y no debería reabrirse cada vez que lanzás una
  campaña nueva.
