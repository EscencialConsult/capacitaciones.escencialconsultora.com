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
 * HTML base que ya está en producción (migrado del sistema viejo,
 * ver supabase/migrations/0002_seed.sql). Sirve como punto de partida
 * al crear una plantilla nueva, y es el mismo HTML que se le pasa a
 * una IA en el prompt de abajo — así nunca hay que reinventar la
 * lógica del formulario (POST a /api/leads, el {{__landing_id__}}
 * oculto), solo el diseño visual.
 */
export const HTML_BASE = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{titulo}}</title>
<style>
  :root {
    --azul: #1a4fd6;
    --azul-oscuro: #0f2f7a;
    --gris-texto: #2b2b33;
    --fondo: #f6f7fb;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    background: var(--fondo);
    color: var(--gris-texto);
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 24px;
  }
  .card {
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 10px 40px rgba(15, 47, 122, 0.12);
    padding: 40px;
    max-width: 440px;
    width: 100%;
  }
  h1 { font-size: 1.5rem; margin-bottom: 8px; }
  p.subtitulo { color: #666; margin-bottom: 28px; font-size: 0.95rem; }
  label { display: block; font-size: 0.85rem; font-weight: 600; margin: 16px 0 6px; }
  input {
    width: 100%;
    padding: 12px 14px;
    border: 1px solid #dcdfe6;
    border-radius: 10px;
    font-size: 1rem;
  }
  input:focus { outline: none; border-color: var(--azul); }
  button {
    width: 100%;
    margin-top: 24px;
    padding: 14px;
    border: none;
    border-radius: 10px;
    background: var(--azul);
    color: #fff;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
  }
  button:hover { background: var(--azul-oscuro); }
  button:disabled { opacity: 0.6; cursor: not-allowed; }
  #mensaje { margin-top: 18px; font-size: 0.9rem; text-align: center; display: none; }
  #mensaje.ok { color: #1a7a3a; display: block; }
  #mensaje.error { color: #b3261e; display: block; }
</style>
</head>
<body>
<div class="card">
  <h1>{{titulo}}</h1>
  <p class="subtitulo">{{subtitulo}}</p>
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
</div>
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
        mensaje.className = 'ok';
        form.reset();
      } else {
        throw new Error(data.error || 'Error desconocido');
      }
    } catch (err) {
      mensaje.textContent = 'Hubo un problema al enviar. Probá de nuevo en un momento.';
      mensaje.className = 'error';
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
 * el HTML real va adentro, no descrito.
 */
export function armarPromptPlantillaNueva() {
  return `Necesito un diseño nuevo de landing para mi plataforma. Antes de generar nada, preguntame UNA COSA a la vez y esperá mi respuesta:

1. ¿Qué estilo/tema visual querés? (colores, referencia de marca, humor de la campaña, etc.)

Con esa respuesta, generame un HTML nuevo partiendo EXACTAMENTE del que pego abajo — es el código real ya en producción. NO toques el JavaScript del formulario, ni el fetch a /api/leads, ni el input oculto "landing_id", ni los nombres de los campos (nombre, apellido, email, phone). Lo ÚNICO que cambia es el diseño visual: el <style> y la estructura del <div class="card"> (o equivalente).

Las 3 variables son SIEMPRE las mismas, no inventes otras: {{titulo}}, {{subtitulo}}, {{boton_texto}}. Dejalas en el HTML tal cual, como placeholders — no les pongas texto fijo, esos valores se completan después al crear cada landing.

HTML base (no tocar la lógica, solo el diseño):

\`\`\`html
${HTML_BASE}
\`\`\`

Cuando termines, dame el HTML completo listo para pegar en el campo "HTML de la plantilla" del panel — nada más, sin explicaciones extra en el medio del código.`;
}
