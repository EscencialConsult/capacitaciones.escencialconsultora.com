export type VariableSchema = {
  key: string;
  label: string;
  type: 'text' | 'textarea';
  // Qué va en ese campo, en qué formato/tono — la IA que arma el HTML
  // la escribe (ver armarPromptPlantillaNueva, bloque B), no se infiere
  // del nombre de la clave. Sin esto, el prompt de campaña solo puede
  // mostrar "plan_1_precio" y una etiqueta linda, pero no explica qué
  // formato/contenido corresponde ahí — description cierra ese hueco.
  description?: string;
};

export type DescripcionVariable = { label?: string; descripcion?: string };

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
 * Fusiona lo detectado automáticamente del HTML con las descripciones
 * que pegó el usuario (bloque B del prompt de plantilla — ver más
 * abajo). Si una clave no tiene descripción pegada, se queda con el
 * label auto-generado y sin description — no es obligatorio pegar el
 * bloque B, es una mejora, no un requisito para guardar la plantilla.
 */
export function combinarVariables(
  detectadas: VariableSchema[],
  descripciones?: Record<string, DescripcionVariable> | null
): VariableSchema[] {
  if (!descripciones) return detectadas;
  return detectadas.map((v) => {
    const meta = descripciones[v.key];
    if (!meta) return v;
    return {
      ...v,
      label: meta.label?.trim() || v.label,
      description: meta.descripcion?.trim() || undefined,
    };
  });
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
 * Email "simple" — se usa en dos lugares: (1) como respaldo cuando un
 * paso de campaña queda SIN diseño de email elegido (ver
 * lib/email/process-pending.ts, el diseño ahora es opcional), y (2)
 * como contenido inicial del modal "+ Crear diseño" en el formulario
 * de campaña, para no arrancar de un textarea vacío. Placeholders que
 * process-pending.ts sabe reemplazar: {{nombre}}, {{contenido}},
 * {{whatsapp_url}}, {{asesora_nombre}}.
 */
export const HTML_EMAIL_BASE = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Escencial Consultora</title>
</head>
<body style="font-family: Arial, sans-serif; color: #1a181d; line-height: 1.5;">

<p>Hola {{nombre}},</p>

<p>{{contenido}}</p>

<p><a href="{{whatsapp_url}}">Hablar por WhatsApp</a></p>

<p style="margin-top: 24px; font-size: 12px; color: #7880a4;">
  {{asesora_nombre}} — Escencial Consultora
</p>

</body>
</html>`;

/**
 * Datos reales de contacto de Escencial Consultora, sacados del sitio
 * en vivo (escencialconsultora.com.ar) el 2026-08-12 — nunca inventar
 * otra dirección/teléfono/red social acá ni dejar que la IA los invente
 * en el prompt. Instagram no está entre sus redes publicadas; si en
 * algún momento se suma, agregarlo acá (única fuente de verdad).
 */
export const INFO_FOOTER_ESCENCIAL = `Escencial Consultora
Tucumán: Catamarca 873, San Miguel de Tucumán · +54 9 3816 22-1565
Buenos Aires: Paraguay 635, C1008AAT, CABA · +54 9 11 3358-8062
Bolivia: Manzana 40, torre 2, piso 10, Santa Cruz de la Sierra · +591 62843954
Email: info@escencialconsult.com.ar
Facebook: https://www.facebook.com/escencialconsultora/
Twitter/X: https://twitter.com/EscencialConsu
LinkedIn: https://www.linkedin.com/company/escencialconsultora/
© 2026 Escencial Consultora — Todos los derechos reservados.`;

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
   - Agregá un footer al final con los datos reales de contacto de acá abajo — SIEMPRE estos datos exactos, tal cual están escritos (dirección, teléfonos, email, redes), nunca inventes otros ni los cambies. Diseñalo acorde al resto (colores, tipografía), pero el texto y los links no se tocan. No hace falta poner las 3 sucursales una al lado de la otra si no entran bien visualmente — un acordeón, tabs, o simplemente apiladas en columnas también sirve, es una decisión de layout, no de contenido.

Dame DOS bloques, nada de explicaciones antes ni después:

A) El HTML completo, como se explicó arriba.

B) Un JSON válido (sin comentarios, sin texto alrededor) con una entrada por cada {{clave}} que hayas usado (excepto los reservados titulo/subtitulo/boton_texto/__landing_id__ si los dejaste tal cual, esos ya los conozco) — para cada una, un label corto en español y una descripción de una línea de QUÉ va ahí y en qué formato/tono, para que después, al crear una campaña con esta plantilla, se sepa exactamente qué escribir en cada campo sin tener que adivinar por el nombre de la clave:

{
  "precio_plan_1": { "label": "Precio del plan 1", "descripcion": "Precio con formato $X.XXX, sin decimales, ej: $49.999" },
  "faq_1_pregunta": { "label": "Pregunta 1 del FAQ", "descripcion": "Una pregunta frecuente real sobre el curso, corta, en tono cercano" }
}

HTML base (función fija, diseño libre):

\`\`\`html
${HTML_BASE}
\`\`\`

Datos reales para el footer (usar tal cual, nunca inventar otros):

\`\`\`
${INFO_FOOTER_ESCENCIAL}
\`\`\`

Cómo lo voy a usar yo (no hace falta que hagas nada con esto, es solo contexto): el HTML (A) lo subo como plantilla nueva en el panel — el nombre interno de la plantilla y la categoría los cargo yo directo ahí, no hace falta que me los preguntes. El JSON (B) lo pego en el campo "Descripciones de variables" de esa misma pantalla — así el prompt que voy a copiar después, cuando cree una campaña con esta plantilla, ya sabe qué significa cada variable.`;
}

/**
 * Un solo JSON con TODO (2026-08-12, corregido) — la primera versión
 * pedía un JSON solo para las variables y el resto en texto plano para
 * completar a mano; la experiencia real mostró que tiene mucho más
 * sentido pegar UN SOLO bloque y que complete el formulario entero de
 * una — asesora, WhatsApp, los 4 emails Y las variables de contenido.
 * El cuadro "Pegar JSON" de /admin/campaigns/new entiende esta
 * estructura completa (ver CampaignForm.tsx → aplicarJson). Lo único
 * que NO viaja acá: el diseño de cada email (elección aparte, a mano)
 * y el link/slug — ese ya no es una decisión de campaña, es propiedad
 * de la Landing (se elige o se crea ANTES, en el paso 1 del form, ver
 * supabase/migrations/0004_separar_campanas_de_landings.sql).
 */
export function armarPromptCampanaNueva(variables: { key: string; label: string; description?: string }[]) {
  const listaVariables = variables.length
    ? variables
        .map((v) => `   - ${v.key} → ${v.label}${v.description ? ` — ${v.description}` : ''}`)
        .join('\n')
    : '   (esta plantilla no tiene ningún campo de texto propio)';

  const jsonVariables = variables.length
    ? `{\n${variables.map((v) => `      "${v.key}": "..."`).join(',\n')}\n    }`
    : '{}';

  return `Necesito armar una campaña nueva para mi plataforma, conectada a una landing que ya existe — el diseño y el link ya están resueltos, no me preguntes nada de estilo, HTML, ni el slug/link. Antes de generar nada, hacéme estas preguntas UNA POR UNA y esperá mi respuesta a cada una:

1. Nombre interno de la campaña, para identificarla en el panel (ejemplo: "Liquidación Agosto 2026").

2. Nombre y WhatsApp de la asesora asignada. El número va en formato internacional, sin + ni espacios ni guiones (ejemplo: 5493815551234). Además, el texto que va a aparecer PRELLENADO en el WhatsApp del LEAD cuando haga click en el botón del email — un mensaje redactado en primera persona, como si el LEAD se lo estuviera escribiendo a la asesora (ejemplo: "Hola, quiero más info sobre la campaña"). OJO: esto NO es un aviso automático que el sistema le manda a la asesora — el sistema no manda WhatsApps por su cuenta. Lo único que hace es abrir el WhatsApp del lead con este texto ya escrito, listo para que él decida mandarlo.

3. Para cada uno de los hasta 4 emails de seguimiento que quieras activar (podés usar 1, 2, 3 o los 4 — el 1 es obligatorio, los demás se saltean solos si los dejás sin usar, no hace falta rellenar con texto tipo "N/A"):
   - Días después del registro en que se manda (0 = inmediato).
   - Asunto del email.
   - Contenido/speech de ese paso puntual.

4. El contenido real para cada uno de estos campos que tiene la plantilla de la landing que elegiste (nunca inventes vos el contenido de negocio, eso lo doy yo):
${listaVariables}

Con esas respuestas, generame UN SOLO JSON válido (sin comentarios, sin texto alrededor de ningún tipo), con exactamente esta estructura:

{
  "name": "...",
  "advisor_name": "...",
  "whatsapp_number": "...",
  "whatsapp_message": "...",
  "variables": ${jsonVariables},
  "emails": [
    { "step": 1, "offset_days": 0, "subject": "...", "content": "..." },
    { "step": 2, "offset_days": 0, "subject": "...", "content": "..." }
  ]
}

Reglas del array "emails": un objeto por cada paso que sí vayas a usar, en orden (step 1, 2, 3 o 4) — si un paso no se usa, no lo incluyas en el array (nunca un objeto vacío ni "no usar").

Cómo lo voy a usar yo (no hace falta que hagas nada con esto, es solo contexto): pego este JSON completo en el cuadro "Pegar JSON" del formulario de campaña nueva y completa TODO solo — nombre, asesora, WhatsApp, cada email y las variables de contenido. Lo único que reviso a mano después es qué diseño de email usa cada paso (eso lo elijo yo en un desplegable, no depende del contenido).`;
}
