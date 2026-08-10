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
 * Prompt autosuficiente para pedirle a cualquier IA un diseño nuevo de
 * plantilla, sin que tenga que adivinar la lógica del formulario —
 * mismo criterio que el prompt del sistema viejo (docs/generar-campana-nueva.md):
 * el HTML real va adentro, no descrito. Deja explícito que el diseño
 * visual es 100% libre — lo único fijo es cómo se envían los datos.
 */
export function armarPromptPlantillaNueva() {
  return `Necesito un diseño nuevo de landing para mi plataforma. Antes de generar nada, preguntame UNA COSA a la vez y esperá mi respuesta:

1. ¿Qué estilo/tema visual querés? (colores, referencia de marca, humor de la campaña, etc.)

El HTML de abajo tiene SOLO la parte funcional (los campos del formulario y el script que manda los datos) — no tiene ningún diseño, ni colores, ni layout. Tu trabajo es vestirlo por completo: agregar el <style>, reorganizar el <body> como quieras (tarjeta centrada, fullscreen, lo que sea), tipografías, colores, animaciones. Tenés libertad total en lo visual.

Lo único que NO podés tocar es la parte funcional: los inputs del formulario con sus atributos "name" exactos (nombre, apellido, email, phone, y el input oculto "landing_id"), el bloque <script> completo tal cual (hace el fetch a /api/leads con esos datos), y los 3 placeholders {{titulo}}, {{subtitulo}}, {{boton_texto}} — tienen que seguir estando en el HTML final, en algún lugar del diseño que armes, sin texto fijo reemplazándolos.

HTML base (función fija, diseño libre):

\`\`\`html
${HTML_BASE}
\`\`\`

Cuando termines, dame el HTML completo (con tu diseño ya integrado) listo para pegar en el campo "HTML de la plantilla" del panel — nada más, sin explicaciones extra en el medio del código.`;
}
