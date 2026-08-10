/**
 * Prompt equivalente al que usaba el sistema viejo
 * (docs/generar-campana-nueva.md) para juntar todos los datos de una
 * campaña — nombre, asesora, WhatsApp, timing y contenido de cada
 * email. La diferencia con el sistema viejo: ahí el resultado era una
 * fila para pegar en una Sheet; acá no hay Sheet, el resultado es una
 * lista clara de valores para completar en los campos de este mismo
 * formulario (/admin/landings/new).
 *
 * El diseño visual NO se pide acá — para eso está el prompt de
 * plantillas (lib/landing-template-defaults.ts), porque plantilla y
 * landing son cosas separadas en este sistema (una plantilla se
 * reutiliza entre varias landings).
 */
export function armarPromptLandingNueva() {
  return `Necesito armar una landing nueva para mi plataforma. Antes de darme nada, hacéme estas preguntas UNA POR UNA y esperá mi respuesta a cada una:

1. Nombre de la landing — se usa como "link" (slug). Tiene que ser en minúsculas, sin espacios ni acentos, palabras separadas por guion, terminado en mes+año abreviado. Ejemplo bueno: liquidacion-ago26. ¿Cuál querés para esta? (además pedime un nombre interno más descriptivo, para identificarla en el panel).

2. Nombre y WhatsApp de la asesora asignada a esta landing. El número va en formato internacional, sin + ni espacios ni guiones (ejemplo: 5493815551234). Además, el texto que va a aparecer PRELLENADO en el WhatsApp del LEAD cuando haga click en el botón del email — un mensaje redactado en primera persona, como si el LEAD se lo estuviera escribiendo a la asesora (ejemplo: "Hola, quiero más info sobre la campaña"). OJO: esto NO es un aviso automático que el sistema le manda a la asesora — el sistema no manda WhatsApps por su cuenta. Lo único que hace es: cuando el lead clickea el botón, se abre SU WhatsApp con este texto ya escrito, listo para que él decida mandarlo. Lo que sí queda registrado automáticamente es la fecha de ese click.

3. Para cada uno de los hasta 4 emails de seguimiento que quieras activar (podés usar 1, 2, 3 o los 4 — el 1 es obligatorio, los demás se saltean solos si los dejás vacíos):
   - Días después del registro en que se manda (0 = inmediato).
   - Asunto del email.
   - Contenido/speech de ese paso puntual.

4. Título, subtítulo y texto del botón que va a mostrar la landing (son las 3 variables fijas de cualquier plantilla del sistema).

Con esas respuestas, armame un resumen en este formato exacto, listo para que yo copie cada valor al campo correspondiente del formulario "Nueva landing" del panel (no es una fila de spreadsheet, es un formulario web):

---
Link (slug): ...
Nombre interno: ...
Título: ...
Subtítulo: ...
Texto del botón: ...
Asesora — nombre: ...
Asesora — WhatsApp: ...
Mensaje prellenado de WhatsApp: ...

Email 1 — días: ... / asunto: ... / contenido: ...
Email 2 — días: ... / asunto: ... / contenido: ... (o "no usar" si no aplica)
Email 3 — días: ... / asunto: ... / contenido: ... (o "no usar" si no aplica)
Email 4 — días: ... / asunto: ... / contenido: ... (o "no usar" si no aplica)
---

No inventes un diseño de landing ni de email en esta conversación — la plantilla visual se elige aparte, de las que ya existen en el panel (o se pide con el otro prompt de "generar plantilla nueva").`;
}
