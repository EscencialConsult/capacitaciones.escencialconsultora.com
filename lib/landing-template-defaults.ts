export type VariableSchema = { key: string; label: string; type: 'text' | 'textarea' };

// Labels prolijas para las variables de siempre — cualquier otra clave
// nueva que aparezca en el HTML se etiqueta automáticamente a partir de
// su nombre (ver etiquetaDesdeClave), sin que haga falta mantener esta
// lista al día para cada plantilla nueva.
const ETIQUETAS_CONOCIDAS: Record<string, string> = {
  titulo: 'Título principal',
  subtitulo: 'Subtítulo',
  boton_texto: 'Texto del botón',
};

// Si la clave sugiere contenido largo (un párrafo, una descripción),
// se le asigna textarea en vez de un input de una sola línea — pura
// comodidad de carga, no cambia en nada cómo se guarda el dato.
const PISTAS_TEXTO_LARGO = ['contenido', 'descripcion', 'texto', 'bajada', 'parrafo', 'detalle'];

function etiquetaDesdeClave(key: string): string {
  const frase = key.split('_').filter(Boolean).join(' ');
  return frase.charAt(0).toUpperCase() + frase.slice(1);
}

/**
 * Reemplazo de VARIABLES_SCHEMA_FIJO: en vez de forzar siempre las
 * mismas 3 variables (titulo/subtitulo/boton_texto), se detectan solas
 * a partir del HTML que se pega en la plantilla — cualquier {{clave}}
 * que aparezca se vuelve un campo del formulario de campaña, sin
 * necesidad de una interfaz de JSON a mano (eso ya se probó y no
 * funcionó bien acá). El reservado {{__landing_id__}} nunca se cuenta,
 * lo inyecta el sistema siempre, no es algo que se cargue por campaña.
 */
export function extraerVariablesDeHtml(html: string): VariableSchema[] {
  const encontradas = new Set<string>();
  const regex = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html))) {
    const clave = match[1];
    if (clave === '__landing_id__') continue;
    encontradas.add(clave);
  }
  return Array.from(encontradas).map((key) => ({
    key,
    label: ETIQUETAS_CONOCIDAS[key] ?? etiquetaDesdeClave(key),
    type: PISTAS_TEXTO_LARGO.some((pista) => key.includes(pista)) ? 'textarea' : 'text',
  }));
}

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
 * DOS prompts separados (2026-08-12) — antes había uno solo que mezclaba
 * diseño con datos de campaña, y eso ya no tiene sentido con Plantillas
 * y Campañas separadas (ver campaigns/ vs templates/): la plantilla es
 * el diseño reutilizable, la campaña es cada instancia con su propia
 * asesora/WhatsApp/emails. Pedirle a la IA el nombre de la asesora
 * mientras se está armando SOLO el diseño no corresponde — eso se
 * completa después, en /admin/campaigns/new, conectado a la plantilla
 * ya subida.
 *
 * armarPromptPlantillaNueva(): solo estética + estructura. No pregunta
 * nombre, asesora, WhatsApp, ni contenido de emails — de eso no sabe
 * nada una plantilla. Devuelve solo el HTML.
 *
 * armarPromptCampanaNueva(variables): solo datos de campaña. No genera
 * HTML ni pregunta de diseño — el diseño ya está resuelto por la
 * plantilla elegida. Es dinámico: la lista de variables a completar
 * depende de qué plantilla se seleccionó en el formulario (ver
 * CampaignForm.tsx → variablesDeLaPlantilla), así que dos campañas con
 * plantillas distintas copian un prompt distinto.
 *
 * Ninguno de los dos pide Tailwind por CDN — Tailwind mismo lo
 * desaconseja para producción (manda el compilador JIT completo al
 * navegador de cada visitante, más lento justo en la página que más
 * importa que cargue rápido).
 */
export function armarPromptPlantillaNueva() {
  return `Necesito armar una plantilla de landing nueva para mi plataforma — esto es SOLO el diseño visual reutilizable. No es una campaña puntual: el nombre de la campaña, la asesora, el WhatsApp y el contenido de los emails de seguimiento se cargan después, en otro paso, cuando conecte esta plantilla a una campaña real. No me preguntes nada de eso.

Antes de generar nada, hacéme estas preguntas UNA POR UNA y esperá mi respuesta a cada una:

1. Qué secciones necesita la landing (por ejemplo: hero con título/subtítulo/botón, beneficios o módulos, planes de precio, testimonios, preguntas frecuentes, footer con datos de contacto). Para cada sección que uses, decime qué campos van a cambiar de una campaña a otra — por ejemplo, en una sección de precios: ¿cuántos planes hay?, ¿cada uno tiene nombre + precio + texto de botón propio? Todavía no hace falta contenido real, eso se completa por campaña.

2. Estilo/diseño visual: colores, referencia de marca, humor, alguna landing existente que te guste como referencia. Si no tengo nada específico, decime que uses cualquier estilo prolijo y moderno.

Con esas respuestas, generame el HTML completo de la plantilla. Partí EXACTAMENTE del HTML base de acá abajo — es la parte funcional real, ya probada (el formulario y el script que mandan los datos). NO toques los inputs, sus atributos "name", el input oculto "landing_id", ni el bloque <script>. Lo único que agregás es el diseño visual completo alrededor:
   - Meté todo el estilo en una etiqueta <style> propia, escrito a mano (CSS normal) — NADA de Tailwind por CDN ni ningún framework externo de CSS/JS: la landing tiene que cargar rápido para el lead que recién llega.
   - Si necesitás una tipografía distinta a la del sistema, podés importarla de Google Fonts en el <head> (con display=swap para que no haya parpadeo de texto invisible mientras carga).
   - Íconos: SVG inline si hacen falta, nunca una librería de íconos externa.
   - Cada campo de contenido que vaya a variar por campaña (título, precio, lo que sea) va como {{clave}} — elegí vos el nombre de cada clave, en minúsculas y sin espacios (ej: {{precio_plan_1}}). No hace falta declararlas en ningún lado aparte: el sistema las detecta solas apenas pegue este HTML en el panel.
   - Los placeholders {{titulo}}, {{subtitulo}}, {{boton_texto}} y el reservado {{__landing_id__}} ya vienen en el HTML base — podés mantenerlos, moverlos, o sacarlos y usar tus propias claves si el diseño no los necesita tal cual. Lo único que no se toca es la lógica del <form> y el <script>.

Dame directo el HTML completo, sin explicaciones antes ni después.

HTML base (función fija, diseño libre):

\`\`\`html
${HTML_BASE}
\`\`\`

Cómo lo voy a usar yo (no hace falta que hagas nada con esto, es solo contexto): este HTML lo subo como plantilla nueva en el panel — el nombre interno de la plantilla y la categoría los cargo yo directo ahí, no hace falta que me los preguntes.`;
}

export function armarPromptCampanaNueva(variables: { key: string; label: string }[]) {
  const listaVariables = variables.length
    ? variables.map((v) => `   - ${v.label} (clave interna: ${v.key})`).join('\n')
    : '   (esta plantilla no tiene ningún campo de texto propio — no hace falta preguntar nada acá)';

  const formatoResumenVariables = variables.length
    ? variables.map((v) => `${v.label}: ...`).join('\n')
    : '(sin variables de contenido en esta plantilla)';

  return `Necesito armar una campaña nueva para mi plataforma, usando una plantilla de landing que ya existe — el diseño ya está resuelto, no me preguntes nada de estilo ni me generes HTML. Antes de generar nada, hacéme estas preguntas UNA POR UNA y esperá mi respuesta a cada una:

1. Nombre de la campaña — se usa como link (slug). Tiene que ser en minúsculas, sin espacios ni acentos, palabras separadas por guion, terminado en mes+año abreviado. Ejemplo bueno: liquidacion-ago26. Pedime también un nombre interno más descriptivo para identificarla en el panel.

2. Nombre y WhatsApp de la asesora asignada. El número va en formato internacional, sin + ni espacios ni guiones (ejemplo: 5493815551234). Además, el texto que va a aparecer PRELLENADO en el WhatsApp del LEAD cuando haga click en el botón del email — un mensaje redactado en primera persona, como si el LEAD se lo estuviera escribiendo a la asesora (ejemplo: "Hola, quiero más info sobre la campaña"). OJO: esto NO es un aviso automático que el sistema le manda a la asesora — el sistema no manda WhatsApps por su cuenta. Lo único que hace es abrir el WhatsApp del lead con este texto ya escrito, listo para que él decida mandarlo.

3. Para cada uno de los hasta 4 emails de seguimiento que quieras activar (podés usar 1, 2, 3 o los 4 — el 1 es obligatorio, los demás se saltean solos si los dejás sin usar, no hace falta rellenar con texto tipo "N/A"):
   - Días después del registro en que se manda (0 = inmediato).
   - Asunto del email.
   - Contenido/speech de ese paso puntual.

4. El contenido real para cada uno de estos campos que tiene la plantilla que elegiste (nunca inventes vos el contenido de negocio, eso lo doy yo):
${listaVariables}

Con esas respuestas, generame un resumen con este formato exacto, nada de explicaciones antes ni después:

---
${formatoResumenVariables}

Asesora — nombre: ...
Asesora — WhatsApp: ...
Mensaje prellenado de WhatsApp: ...

Email 1 — días: ... / asunto: ... / contenido: ...
Email 2 — días: ... / asunto: ... / contenido: ... (o "no usar")
Email 3 — días: ... / asunto: ... / contenido: ... (o "no usar")
Email 4 — días: ... / asunto: ... / contenido: ... (o "no usar")
---

Cómo lo voy a usar yo (no hace falta que hagas nada con esto, es solo contexto): este resumen lo uso para completar el formulario de campaña nueva, ya conectado a la plantilla elegida.`;
}
