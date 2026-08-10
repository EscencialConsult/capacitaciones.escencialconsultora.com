/**
 * Las 3 variables (titulo, subtitulo, boton_texto) son fijas para TODAS
 * las plantillas de landing, siguiendo el mismo esquema del sistema
 * viejo (index.html original) — nunca cambian, así que se usan como
 * default en vez de arrancar con un JSON vacío que haya que escribir
 * a mano cada vez.
 */
export const VARIABLES_SCHEMA_FIJO = [
  { key: 'titulo', label: 'Título principal', type: 'text' },
  { key: 'subtitulo', label: 'Subtítulo', type: 'text' },
  { key: 'boton_texto', label: 'Texto del botón', type: 'text' },
];

/**
 * SOLO la parte funcional (los campos que se envían y el JS que los
 * manda a /api/leads) — sin ningún diseño visual (nada de colores,
 * layout, sombras). El diseño es 100% libre cada vez; lo único que se
 * mantiene siempre igual es cómo se capturan y envían los datos, que
 * es lo que ya traía el sistema desde el principio y no debería
 * reinventarse en cada plantilla.
 */
export const HTML_BASE = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{titulo}}</title>
</head>
<body>

<h1>{{titulo}}</h1>
<p>{{subtitulo}}</p>

<form id="form-lead">
  <input type="hidden" name="landing_id" value="{{__landing_id__}}">

  <label for="nombre">Nombre</label>
  <input type="text" id="nombre" name="nombre" required>

  <label for="apellido">Apellido</label>
  <input type="text" id="apellido" name="apellido" required>

  <label for="email">Email</label>
  <input type="email" id="email" name="email" required>

  <label for="telefono">Teléfono (opcional)</label>
  <input type="tel" id="telefono" name="phone">

  <button type="submit" id="btn-enviar">{{boton_texto}}</button>
  <div id="mensaje"></div>
</form>

<script>
  const form = document.getElementById('form-lead');
  const boton = document.getElementById('btn-enviar');
  const mensaje = document.getElementById('mensaje');
  const textoOriginal = boton.textContent;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    boton.disabled = true;
    boton.textContent = 'Enviando...';
    mensaje.style.display = 'none';

    const datos = Object.fromEntries(new FormData(form));

    try {
      const resp = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos)
      });
      const data = await resp.json();

      if (data.ok) {
        mensaje.textContent = data.duplicado
          ? 'Ya estabas registrado. ¡Gracias!'
          : '¡Listo! En breve nos contactamos.';
        mensaje.style.color = 'green';
        mensaje.style.display = 'block';
        form.reset();
      } else {
        throw new Error(data.error || 'Error desconocido');
      }
    } catch (err) {
      mensaje.textContent = 'Hubo un problema al enviar. Probá de nuevo en un momento.';
      mensaje.style.color = 'red';
      mensaje.style.display = 'block';
      console.error(err);
    } finally {
      boton.disabled = false;
      boton.textContent = textoOriginal;
    }
  });
</script>

</body>
</html>`;

/**
 * UN SOLO prompt — mismo criterio que docs/generar-campana-nueva.md del
 * sistema viejo: ahí un solo prompt pedía nombre de campaña, asesora,
 * WhatsApp, timing/contenido de los 4 emails, Y el diseño, todo junto,
 * y devolvía una fila de Sheets + un HTML. Acá no cambia el flujo de
 * conversación con la IA — sigue siendo una sola tanda de preguntas —
 * lo único que cambia es que el resultado final se reparte en dos
 * lugares del panel en vez de un archivo y una fila: la plantilla
 * (el HTML) va en /admin/templates/new, y el resto de los datos
 * (asesora, WhatsApp, contenido de los emails) va en
 * /admin/landings/new, donde esa landing se conecta a la plantilla que
 * acabás de subir.
 */
export function armarPromptCampanaNueva() {
  return `Necesito armar una landing nueva para mi plataforma. Antes de generar nada, hacéme estas preguntas UNA POR UNA y esperá mi respuesta a cada una:

1. Nombre de la landing — se usa como link (slug). Tiene que ser en minúsculas, sin espacios ni acentos, palabras separadas por guion, terminado en mes+año abreviado. Ejemplo bueno: liquidacion-ago26. Pedime también un nombre interno más descriptivo para identificarla en el panel.

2. Nombre y WhatsApp de la asesora asignada. El número va en formato internacional, sin + ni espacios ni guiones (ejemplo: 5493815551234). Además, el texto que va a aparecer PRELLENADO en el WhatsApp del LEAD cuando haga click en el botón del email — un mensaje redactado en primera persona, como si el LEAD se lo estuviera escribiendo a la asesora (ejemplo: "Hola, quiero más info sobre la campaña"). OJO: esto NO es un aviso automático que el sistema le manda a la asesora — el sistema no manda WhatsApps por su cuenta. Lo único que hace es abrir el WhatsApp del lead con este texto ya escrito, listo para que él decida mandarlo.

3. Para cada uno de los hasta 4 emails de seguimiento que quieras activar (podés usar 1, 2, 3 o los 4 — el 1 es obligatorio, los demás se saltean solos si los dejás sin usar, no hace falta rellenar con texto tipo "N/A"):
   - Días después del registro en que se manda (0 = inmediato).
   - Asunto del email.
   - Contenido/speech de ese paso puntual.

4. Título, subtítulo y texto del botón que va a mostrar la landing.

5. Por último, pedime el estilo/diseño visual que querés (colores, referencia de marca, humor de la campaña). Si no tengo nada específico, decime que uses cualquier estilo prolijo.

Con esas respuestas, generame DOS cosas:

A) El HTML completo de la landing. Partí EXACTAMENTE del HTML base de acá abajo — es la parte funcional real, ya probada (el formulario y el script que mandan los datos). NO toques los inputs, sus atributos "name", el input oculto "landing_id", ni el bloque <script>. Lo único que agregás es el diseño visual completo alrededor (agregá el <style>, reorganizá el <body> como quieras) según el punto 5, y dejá los placeholders {{titulo}}, {{subtitulo}}, {{boton_texto}} tal cual, sin texto fijo reemplazándolos.

B) Un resumen con el resto de los datos, en este formato exacto:

---
Título: ...
Subtítulo: ...
Texto del botón: ...
Asesora — nombre: ...
Asesora — WhatsApp: ...
Mensaje prellenado de WhatsApp: ...

Email 1 — días: ... / asunto: ... / contenido: ...
Email 2 — días: ... / asunto: ... / contenido: ... (o "no usar")
Email 3 — días: ... / asunto: ... / contenido: ... (o "no usar")
Email 4 — días: ... / asunto: ... / contenido: ... (o "no usar")
---

HTML base (función fija, diseño libre):

\`\`\`html
${HTML_BASE}
\`\`\`

Cuando termines, dame primero el HTML completo (A), y después el resumen (B) — nada de explicaciones extra en el medio.

Cómo lo voy a usar yo (no hace falta que hagas nada con esto, es solo contexto): el HTML (A) lo subo como plantilla nueva en el panel; el resumen (B) lo uso para crear la landing y conectarla a esa plantilla.`;
}
