# Prompt para generar una campaña/landing nueva

Cada vez que quieras una landing nueva (o relanzar una existente con
cambios), copiá el bloque de abajo **completo, tal cual, incluido el
HTML** — y pegáselo a la IA en un chat nuevo, incluso uno sin acceso a
este repo (ChatGPT, Gemini, otra sesión de Claude sin archivos, lo que
sea). El prompt trae el código base adentro a propósito, para que la IA
nunca tenga que adivinar el `WEBAPP_URL`, los nombres de los campos ni la
lógica del POST — los copia de acá, no los inventa.

> Si en algún momento actualizás el `index.html` real del repo, actualizá
> también el bloque de código pegado en este prompt, para que no queden
> desincronizados.

---

## Prompt — copiar desde acá

````
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
   estilo, campos visibles). Si no tengo nada específico, decime que dejás
   el mismo estilo del HTML base de más abajo.

Con esas respuestas, generame:

a) La fila lista para pegar en el bloque Config_Campañas de la pestaña
   "Datos" (columnas S:AM) — origen_campaña, asesora_nombre,
   asesora_whatsapp, mensaje_whatsapp, y los offset_dias_N / contenido_N /
   asunto_N que correspondan según lo que activé arriba, con activa=TRUE.
   template_base_N lo dejás vacío si no tengo un diseño de email nuevo
   para esa campaña (reuso el que ya existe).

b) Un archivo HTML de landing nuevo. Partí EXACTAMENTE del HTML base de
   acá abajo — es el código real que ya está en producción, con el
   WEBAPP_URL correcto y la lógica de envío ya probada y funcionando.
   NO reinventes el JavaScript del formulario ni cambies los "name" de
   los inputs, ni el WEBAPP_URL, ni el método de envío (URLSearchParams,
   no JSON — es a propósito, por CORS). Lo ÚNICO que cambia es:
   - El valor del input oculto "origen_campaña" (poné el del punto 1)
   - El diseño visual (colores, tipografía, textos, estructura del <style>
     y del <div class="card">) según lo que te haya pasado en el punto 4

HTML base (no tocar la lógica, solo el diseño y el origen_campaña):

```html
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Landing de prueba — Campaña</title>
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
    transition: background 0.15s ease;
  }
  button:hover { background: var(--azul-oscuro); }
  button:disabled { opacity: 0.6; cursor: not-allowed; }
  #mensaje {
    margin-top: 18px;
    font-size: 0.9rem;
    text-align: center;
    display: none;
  }
  #mensaje.ok { color: #1a7a3a; display: block; }
  #mensaje.error { color: #b3261e; display: block; }
</style>
</head>
<body>

<div class="card">
  <h1>Quiero recibir la información</h1>
  <p class="subtitulo">Dejanos tus datos y te contactamos.</p>

  <form id="form-lead">
    <input type="hidden" name="origen_campaña" value="campaña_prueba_ago26">

    <label for="nombre">Nombre</label>
    <input type="text" id="nombre" name="nombre" required>

    <label for="apellido">Apellido</label>
    <input type="text" id="apellido" name="apellido" required>

    <label for="email">Email</label>
    <input type="email" id="email" name="email" required>

    <label for="telefono">Teléfono (opcional)</label>
    <input type="tel" id="telefono" name="datos_extra">

    <button type="submit" id="btn-enviar">Enviar</button>
    <div id="mensaje"></div>
  </form>
</div>

<script>
  const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbyg3QGXHpaNy3ecaalf_yq41xLohPFycZqmQl5VXyLtkPHxtJotoFKd_vkSzd6zWJbo1A/exec';

  const form = document.getElementById('form-lead');
  const boton = document.getElementById('btn-enviar');
  const mensaje = document.getElementById('mensaje');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    boton.disabled = true;
    boton.textContent = 'Enviando...';
    mensaje.style.display = 'none';

    const datos = new URLSearchParams(new FormData(form));

    try {
      const resp = await fetch(WEBAPP_URL, {
        method: 'POST',
        body: datos
      });
      const data = await resp.json();

      if (data.ok) {
        mensaje.textContent = data.duplicado
          ? 'Ya estabas registrado en esta campaña. ¡Gracias!'
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
      boton.textContent = 'Enviar';
    }
  });
</script>

</body>
</html>
```

No toques Code.gs ni la estructura de columnas de Sheets — esta campaña
tiene que funcionar con el backend que ya existe, sin cambiar una línea
de Apps Script.
````

---

## Por qué está armado así

- **El HTML real va adentro del prompt, no descrito**: la sesión anterior
  falló porque solo veía la landing ya renderizada (el resultado visual),
  no el código — no tenía forma de saber el `WEBAPP_URL` exacto ni los
  `name` de los campos sin inventarlos. Pegando el archivo completo, la
  IA copia en vez de adivinar.
- **Instrucción explícita de "no tocar la lógica"**: sin esa aclaración,
  es común que una IA "mejore" el JavaScript sin que se lo pidan y rompa
  el envío (ej. cambiando a `fetch` con JSON, que falla por CORS acá).
- **Una pregunta a la vez**: evita que termines completando 6 cosas de
  una y te olvides de alguna.
- **Ejemplo de `origen_campaña` incluido**: es el campo que más rompe
  cosas si queda mal escrito, porque tiene que matchear EXACTO entre la
  landing y la fila de `Config_Campañas`.
- **El diseño va al final**: primero se resuelve la lógica, el diseño no
  tapa lo importante.
