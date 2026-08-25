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

/**
 * Marcas con identidad fija (paleta + tipografía + logos ya definidos,
 * no "a elección" en el prompt como el resto). Selección todavía no
 * tiene logos/paleta cargados — se agrega acá el día que lleguen, ver
 * supabase/migrations/0005_marca_en_landing_templates.sql para el
 * check constraint que hay que ampliar también ese día.
 */
export type Marca = 'one' | 'escencial-latam' | 'escencial-argentina' | 'esseleccion';

type ConfigMarca = {
  nombre: string;
  colores: string[];
  // Un degradado característico de la marca, además de la paleta plana
  // — opcional, no todas las marcas tienen uno definido.
  degradado?: string;
  tipografiaPrincipal: string;
  tipografiasSecundarias: string[];
  logos: { blanco: string; negro: string; isotipo: string };
};

// Colores y tipografías tal cual los pasó Facundo (2026-08-13) — nunca
// inventar otros ni "mejorarlos": son la identidad real de cada marca.
export const MARCAS: Record<Marca, ConfigMarca> = {
  one: {
    nombre: 'ONE',
    colores: ['#000000', '#1a181d', '#fefeff', '#e17bd7', '#6be1e3', '#e4c76a', '#a4a8c0', '#c6c9d7'],
    tipografiaPrincipal: 'Exo 2',
    tipografiasSecundarias: ['Futura'],
    logos: {
      blanco: '/logos/one/logo-blanco.webp',
      negro: '/logos/one/logo-negro.webp',
      isotipo: '/logos/one/logo-isotipo.webp',
    },
  },
  'escencial-latam': {
    nombre: 'Escencial LATAM',
    colores: [
      '#210d41', '#b88917', '#e2b808', '#f4ce29', '#47278c',
      '#953a90', '#252525', '#342f1d', '#c0c0c0', '#ffffff',
    ],
    degradado: 'de #280640 a #6e3eab',
    tipografiaPrincipal: 'Neue Einstellung',
    tipografiasSecundarias: ['Poppins', 'Garet', 'Aton'],
    logos: {
      blanco: '/logos/escencial-latam/logo-blanco.webp',
      negro: '/logos/escencial-latam/logo-negro.webp',
      isotipo: '/logos/escencial-latam/logo-isotipo.webp',
    },
  },
  'escencial-argentina': {
    nombre: 'Escencial Argentina',
    colores: [
      '#000000', '#252525', '#c0c0c0', '#ffffff', '#faf1f1',
      '#020f27', '#0b4a6e', '#22d9df', '#1effff', '#6b9432', '#c1ff72',
    ],
    tipografiaPrincipal: 'Catamaran',
    tipografiasSecundarias: ['Poppins', 'Aton', 'Carlito', 'Cerebri'],
    logos: {
      blanco: '/logos/escencial-argentina/logo-blanco.webp',
      negro: '/logos/escencial-argentina/logo-negro.webp',
      isotipo: '/logos/escencial-argentina/logo-isotipo.webp',
    },
  },
  // Colores, tipografía y rutas de logo sacados directo del HTML real
  // que Facundo subió el 2026-08-24 (no inventados) — el nombre visible
  // de la marca ({{marca_nombre}}) queda como variable de campaña en
  // este HTML, no hardcodeado, así que "nombre" acá es solo la etiqueta
  // que se ve en el selector de Marca del panel.
  esseleccion: {
    nombre: 'Esselección',
    colores: ['#FF5500', '#FFB800', '#111111', '#F8F9FA', '#FFFFFF'],
    tipografiaPrincipal: 'Montserrat',
    tipografiasSecundarias: ['Inter'],
    logos: {
      blanco: '/logos/esseleccion/logo-blanco.webp',
      negro: '/logos/esseleccion/logo-negro.webp',
      isotipo: '/logos/esseleccion/logo-isotipo.webp',
    },
  },
};

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
  // Alfabeto español completo (incluye tildes y ñ, vía \p{L} unicode) +
  // guion medio, no solo ASCII — sin esto, una clave como {{título}} o
  // {{precio-plan-1}} nunca se detectaba como variable y quedaba literal
  // en la landing pública, sin ningún aviso en todo el flujo.
  const regex = /\{\{\s*([\p{L}\p{N}_-]+)\s*\}\}/gu;
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
<meta name="description" content="{{subtitulo}}">
<meta property="og:type" content="website">
<meta property="og:title" content="{{titulo}}">
<meta property="og:description" content="{{subtitulo}}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="{{titulo}}">
<meta name="twitter:description" content="{{subtitulo}}">
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
        // Mensaje único, sin importar data.duplicado (2026-08-24) — antes
        // se mostraba "Ya estabas registrado" vs "¡Listo!" según ese
        // campo, y eso convertía el <div id="mensaje"> en un oráculo
        // público: cualquiera con el {{__landing_id__}} de la landing
        // podía probar una lista corta de emails y leer en pantalla,
        // sin login ni tocar la API directo, si esa persona ya estaba
        // registrada ahí (el rate limit de la migración 0015 lo frena a
        // 3 intentos/día por email, pero no lo evita). data.duplicado
        // sigue viajando en el JSON para uso interno/reportes, solo deja
        // de reflejarse en el texto que ve el visitante.
        mensaje.textContent = '¡Listo! En breve nos contactamos.';
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
 * Variante de HTML_BASE para plantillas de "envío personalizado"
 * (2026-08-24) — la única diferencia funcional es el <select
 * name="opcion"> agregado al formulario: el LEAD elige ahí una de
 * hasta 4 opciones, y esa elección decide cuál de los 4 emails
 * configurados en la campaña se le manda (al instante, no en goteo por
 * días) — ver app/api/leads/route.ts, que agenda distinto según
 * landing_templates.envio_personalizado. El JS de abajo es EL MISMO
 * (arma el body con Object.fromEntries(new FormData(form)), así que
 * "opcion" viaja solo apenas se agrega el campo al <form>, no hace
 * falta tocar el <script>). Las 4 opciones son SIEMPRE las mismas 4
 * (correspondiendo 1:1 a los 4 emails que se cargan por campaña) — el
 * texto que ve el lead en cada una es contenido de campaña
 * ({{opcion_1_texto}}..{{opcion_4_texto}}), nunca "Email 1/2/3/4".
 */
export const HTML_BASE_ENVIO_PERSONALIZADO = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{titulo}}</title>
<meta name="description" content="{{subtitulo}}">
<meta property="og:type" content="website">
<meta property="og:title" content="{{titulo}}">
<meta property="og:description" content="{{subtitulo}}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="{{titulo}}">
<meta name="twitter:description" content="{{subtitulo}}">
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

  <label for="opcion">{{opcion_pregunta}}</label>
  <select id="opcion" name="opcion" required>
    <option value="" disabled selected>Elegí una opción</option>
    <option value="1">{{opcion_1_texto}}</option>
    <option value="2">{{opcion_2_texto}}</option>
    <option value="3">{{opcion_3_texto}}</option>
    <option value="4">{{opcion_4_texto}}</option>
  </select>

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
        // Mismo motivo que en HTML_BASE de arriba: mensaje único, sin
        // ramificar por data.duplicado, para no convertir el
        // <div id="mensaje"> en un oráculo público de "¿ya se anotó tal
        // email en esta landing?" — ver el comentario completo ahí.
        mensaje.textContent = '¡Listo! En breve nos contactamos.';
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
 * Llamado único y reutilizable a los logos de ONE + Escencial Argentina
 * (2026-08-14) — antes cada lugar del prompt (header, footer) armaba su
 * propio <img> a mano, con riesgo de que el orden, el alt o la ruta
 * salieran distintos según dónde se usara. Ahora hay UNA sola función
 * que arma el bloque, se llama igual en todos lados (ver bloqueEstilo
 * más abajo para el header, y footerEscencialHtml para el footer), así
 * "cómo se llama a los logos" tiene una sola respuesta en todo el
 * sistema, no una por sección. Orden fijo: ONE primero (marca principal
 * de la landing), Escencial Argentina después — nunca al revés, nunca
 * uno solo.
 */
function logosOneMasArgentina(fondo: 'blanco' | 'negro'): string {
  const one = MARCAS.one.logos[fondo];
  const argentina = MARCAS['escencial-argentina'].logos[fondo];
  // width/height fijos (2026-08-24, Ronda 2 — bug real confirmado: el
  // alto quedaba resuelto solo por CSS, .efc-cobrand img{height:26px},
  // sin nada en el markup) — con esto el navegador reserva el espacio
  // antes de que la imagen termine de cargar, evitando el salto de
  // layout (CLS) mientras carga. 52x26 = proporción real de los .webp
  // (800x400 nativo, medido de los archivos) escalada a los 26px de
  // alto que ya fija el CSS del footer (.efc-cobrand img{height:26px}).
  return `<img src="${one}" alt="ONE" width="52" height="26"><img src="${argentina}" alt="Escencial Argentina" width="52" height="26">`;
}

/**
 * Footer corporativo FIJO (2026-08-14, marca-aware desde el mismo día)
 * — a diferencia de todo lo demás en el sistema de diseño (que es guía,
 * no HTML literal), el cuerpo del footer se pega tal cual, siempre, en
 * TODAS las plantillas sin importar la marca — Facundo lo pidió así
 * después de ver que el footer quedaba distinto cada vez que la IA lo
 * re-diseñaba. Es el pie institucional de Escencial Consultora (la
 * empresa madre), no de la sub-marca de turno — por eso NO usa la
 * paleta de la marca de la plantilla, tiene la suya propia fija.
 * Reconstruido a partir de un screenshot real que pasó Facundo; el
 * contenido sale de INFO_FOOTER_ESCENCIAL de arriba, única fuente de
 * verdad de los datos — si esos datos cambian, cambiarlos ahí y
 * replicar acá.
 *
 * Única excepción marca-aware: cuando marca === 'one', se antepone una
 * fila con los logos de ONE + Escencial Argentina (fondo oscuro, blanco)
 * arriba del wordmark "Escencial." — la regla de "ONE nunca va sola"
 * exige que esos dos logos aparezcan en CUALQUIER lugar de la landing
 * donde se muestre marca, footer incluido, y como el footer es HTML
 * literal que la IA no toca, no había otra forma de cumplirla ahí sin
 * que la IA lo reescribiera (que es justo lo que no queremos). Para
 * cualquier otra marca (o sin marca), el footer queda exactamente igual
 * que siempre, sin logos de sub-marca.
 *
 * Autocontenido (trae su propio <style> con clases con prefijo "efc-"
 * para no chocar con el resto del CSS de la plantilla) para que la IA
 * lo pueda pegar tal cual antes de `</body>` sin tener que mezclar nada
 * en el <style> principal.
 */
export function footerEscencialHtml(marca: Marca | null): string {
  const cobrand =
    marca === 'one'
      ? `<div class="efc-cobrand">${logosOneMasArgentina('blanco')}</div>\n      `
      : '';

  return `<style>
.efc-footer{background:#15141b;color:rgba(255,255,255,.55);padding:64px 32px 32px;font-size:13px;line-height:1.7;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif}
.efc-wrap{max-width:1120px;margin:0 auto;display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:40px}
.efc-cobrand{display:flex;align-items:center;gap:14px;margin:0 0 18px}
.efc-cobrand img{height:26px;width:auto;display:block}
.efc-logo{font-size:19px;font-weight:800;color:#fff;letter-spacing:-.01em;margin:0 0 14px}
.efc-dot{color:#22d9df}
.efc-desc{max-width:32ch;margin:0 0 20px}
.efc-social{display:flex;gap:8px}
.efc-social a{width:32px;height:32px;border:1px solid rgba(255,255,255,.15);border-radius:8px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.6);transition:border-color .15s ease,color .15s ease}
.efc-social a:hover{border-color:rgba(255,255,255,.4);color:#fff}
.efc-label{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#22d9df;margin:0 0 16px}
.efc-city{font-size:12px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:rgba(255,255,255,.85);margin:0 0 4px}
.efc-addr{margin:0 0 16px}
.efc-addr:last-child{margin-bottom:0}
.efc-link{color:inherit;text-decoration:none}
.efc-link:hover{color:#fff}
.efc-bottom{max-width:1120px;margin:40px auto 0;padding-top:24px;border-top:1px solid rgba(255,255,255,.1);font-size:12.5px;color:rgba(255,255,255,.4)}
@media (max-width:768px){.efc-wrap{grid-template-columns:1fr 1fr;gap:32px 24px}.efc-footer{padding:48px 20px 28px}}
@media (max-width:480px){.efc-wrap{grid-template-columns:1fr}}
</style>
<footer class="efc-footer">
  <div class="efc-wrap">
    <div class="efc-col">
      ${cobrand}<p class="efc-logo">Escencial<span class="efc-dot">.</span></p>
      <p class="efc-desc">Transformamos organizaciones a través de consultoría estratégica, tecnología de RR.HH. y desarrollo del talento en LATAM.</p>
      <div class="efc-social">
        <a href="https://www.facebook.com/escencialconsultora/" target="_blank" rel="noreferrer" aria-label="Facebook"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z"/></svg></a>
        <a href="https://twitter.com/EscencialConsu" target="_blank" rel="noreferrer" aria-label="X / Twitter"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 2H22l-7.6 8.68L23.3 22h-6.9l-5.4-6.6L4.8 22H1.7l8.1-9.3L1 2h7.1l4.9 6.03L18.9 2Zm-1.2 18h1.9L7.4 4H5.4l12.3 16Z"/></svg></a>
        <a href="https://www.linkedin.com/company/escencialconsultora/" target="_blank" rel="noreferrer" aria-label="LinkedIn"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.15 1.45-2.15 2.94v5.67H9.35V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.35-1.85 3.59 0 4.25 2.36 4.25 5.44v6.3ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45Z"/></svg></a>
      </div>
    </div>
    <div class="efc-col">
      <p class="efc-label">Argentina</p>
      <p class="efc-city">Tucumán</p>
      <p class="efc-addr">Catamarca 873<br>San Miguel de Tucumán<br>+54 9 3816 22-1565</p>
      <p class="efc-city">Buenos Aires</p>
      <p class="efc-addr">Paraguay 635, C1008AAT<br>CABA<br>+54 9 11 3358-8062</p>
    </div>
    <div class="efc-col">
      <p class="efc-label">Bolivia</p>
      <p class="efc-city">Santa Cruz de la Sierra</p>
      <p class="efc-addr">Manzana 40, Torre 2, Piso 10<br>+591 62843954</p>
    </div>
    <div class="efc-col">
      <p class="efc-label">Contacto</p>
      <p class="efc-addr"><a href="mailto:info@escencialconsult.com.ar" class="efc-link">info@escencialconsult.com.ar</a></p>
    </div>
  </div>
  <div class="efc-bottom">
    <p>© 2026 Escencial Consultora — Todos los derechos reservados.</p>
  </div>
</footer>`;
}

/**
 * Sistema de diseño anti-IA-genérica (2026-08-13, revisado 2026-08-14)
 * — valores concretos sacados de analizar Linear, Vercel y Reforge
 * referencia por referencia (no "buenas prácticas" inventadas). La
 * revisión del 14 incorpora la dirección estética de una landing real
 * de ONE (ver ejemplo/promoparaconsultores-empresas-disc-eneagrama.html
 * — generada por otra IA, con tokens del sitio en vivo
 * one-disc.escencialconsultora.com) que Facundo señaló como el nivel a
 * imitar: más cálida y clara que Linear/Vercel (radios grandes, botón
 * píldora, texto con degradado, textura de fondo sutil), sin dejar de
 * evitar los patrones de "hecho por IA" de la primera versión. Se
 * agrega SIEMPRE al prompt de plantilla nueva, tenga marca fija o no:
 * la paleta/tipografía cambia según la marca (ver MARCAS más arriba),
 * el layout/espaciado/motion es el mismo criterio para todas.
 */
const SISTEMA_DISENO_LANDING = `3. Sistema de diseño — esto NO es una pregunta, no me preguntes nada de esto, aplicalo siempre tal cual, sea cual sea la paleta que hayamos definido arriba:

PROHIBIDO explícitamente (son los patrones que hacen que una landing "se note hecha por IA" — evitalos activamente, no por omisión):
   - Un glow o halo de blur pegado detrás de un texto o imagen puntual para "hacerlo resaltar" (ej: un círculo de color blureado justo detrás del título). Distinto de la textura de fondo permitida más abajo, que no está pegada a ningún elemento particular.
   - Gradiente ocupando el 100% del fondo de una sección. El degradado se usa como acento puntual — texto del título, borde de una tarjeta destacada, botón — nunca como fondo completo de una sección.
   - Emojis usados como ícono de una tarjeta o beneficio (sí están bien como adorno chico suelto en un badge de urgencia/promo, tipo "🎉", eso es distinto a usarlos como ícono funcional).
   - Grid de 3+ tarjetas idénticas, todas con el mismo radius, la misma sombra difusa por defecto y el mismo layout interno — si el contenido no pide que sean 100% simétricas, dales alguna diferencia real (una destacada con borde de degradado, distinto ancho, lo que corresponda).
   - Sombras grandes y difusas (box-shadow con blur de 40px+ y opacidad visible) pegadas directo a botones o textos como recurso decorativo. Las sombras grandes sí sirven para separar una card "flotante" del fondo (ver Tarjetas), pero con blur controlado y opacidad baja.
   - Un ícono de marca inventado tipo "cuadrado/círculo con degradado + un path SVG abstracto de líneas o formas genéricas" cuando no hay un logo real. Eso ES el sello más reconocible de landing hecha por IA en 2025-2026 — si no hay logo (ver punto 2), resolvé la marca con tipografía: el nombre en el peso/tracking del sistema, opcionalmente con un monograma hecho de UNA letra real bien tipografiada (no un ícono abstracto), nunca un glifo inventado sin relación con el nombre.

Estructura (esto es un punto de partida, NO una fórmula fija — el ejemplo real que estás imitando no tiene testimonios, tiene un diagrama propio en el hero y una franja de precios de 4 tarjetas asimétricas: se distingue precisamente por adaptarse al contenido en vez de repetir el mismo molde. Usá tu criterio de qué secciones aportan para ESTE contenido puntual):
   Nav fija arriba (logo + links a las secciones + botón) → Hero con form integrado → franja de prueba social (logos o 3 métricas grandes) → módulos/contenido (qué incluye) → beneficios organizacionales → FAQ en acordeón (colapsado por defecto) → CTA final de cierre con un mensaje DISTINTO al del hero, no repitas la misma frase → footer (ver punto fijo más abajo, no es parte de esto).
   Testimonios: SOLO si en la pregunta 1 surgió contenido real de testimonios para esta landing puntual. Si no hay testimonios reales, no inventes citas de personas que no existen para "completar" el esqueleto — sacá la sección entera antes que rellenarla con texto ficticio.
   Al menos UNA sección tiene que tener un tratamiento visual hecho a medida del contenido específico de esta landing (ver "elemento insignia" más abajo) — no alcanza con que todas las secciones sean variaciones del mismo molde de tarjetas.
   Máximo 6 a 8 secciones, que en mobile ocupen entre 4 y 6 pantallas completas — el lead que entra desde un link de WhatsApp/Instagram decide si le interesa en el primer scroll y medio, así que el hero tiene que dejar clarísimo qué es y dónde carga sus datos antes de la franja de logos.
   Opcional (solo si el caso lo pide, por ejemplo una promo con fecha límite): una barra fina arriba de todo, antes de la nav, con la oferta + un contador en vivo con JS simple + botón de cerrar que guarda la elección en sessionStorage. No es parte del esqueleto por defecto, es un recurso extra para campañas puntuales.

Sustitutos visuales sin fotos (no hay banco de imágenes ni upload — nunca uses una URL externa de foto ni un placeholder tipo "foto acá", resolvé estas secciones con estos recursos):
   - Elemento insignia (OBLIGATORIO, no opcional): un elemento visual construido en CSS/SVG puro que sea específico del CONTENIDO de esta landing puntual — no algo que pondrías igual en cualquier otra landing de cualquier otro rubro. Si el contenido tiene un modelo/framework propio (cuadrantes, ejes, una matriz, un ciclo de pasos), armalo como diagrama (círculo dividido en cuadrantes de color con una letra o palabra corta en cada uno, etiquetas en los ejes). Si no tiene un framework así, inventá igual una composición propia del tema (no una card más): por ejemplo un mini-panel simulando la salida real del servicio, una línea de tiempo, un mapa simple. Va en el hero, al lado del form, ocupando el lugar que en otras landings genéricas ocuparía "una foto de stock".
   - Métricas grandes: en vez de una foto genérica, un número enorme (3.25rem, weight 800, letter-spacing -0.04em, en el color de acento) con un texto corto de 13px debajo (ej: "+1.500 capacitados", "98% de satisfacción"). Sirve para la franja de prueba social — pero solo con números reales que te haya dado el contenido de la pregunta 1, nunca inventados.
   - Si el elemento insignia ya va en el hero, el form no necesita nada más al lado: card con fondo blanco, borde 1px, radius grande (ver Tarjetas), y un badge arriba tipo "Inscripción abierta — cupos limitados".
   - Módulos/contenido en tarjetas horizontales numeradas: número de módulo grande a la izquierda (1.25rem, weight 700, en el color de acento, ancho fijo ~40px), título en negrita y descripción corta a la derecha — en vez de una imagen por módulo.

Tipografía — usá clamp() para que escale sola entre mobile y desktop en vez de un salto brusco en un solo breakpoint (aplicá estos valores salvo que la marca fija ya traiga otra escala definida):
   - H1 del hero: clamp(2.1rem, 4.6vw, 3.6rem), line-height 1.05, letter-spacing -0.03em, weight 800. Nunca más de 2-3 líneas.
   - Se puede aplicar el degradado de acento de la marca a una PARTE del H1 (no todo el título) con background:var(--gradiente); background-clip:text; -webkit-text-fill-color:transparent — es el único lugar donde un degradado ocupa una superficie de texto completa, no cuenta como "fondo de sección".
   - H2 de sección: clamp(1.6rem, 3.4vw, 2.5rem), weight 800, letter-spacing -0.025em.
   - Subtítulo del hero: clamp(1rem, 1.3vw, 1.15rem), line-height 1.5, weight 500, en un tono claramente más atenuado que el título (no el mismo negro/color pleno) para que el ojo jerarquice solo, max-width ~50ch para que no estire de más.
   - Separación entre H1 y subtítulo: apenas 12-20px (van agrupados como una unidad). Separación entre el subtítulo y el CTA/form: 30-36px (ahí sí hay un salto, es donde tiene que aterrizar el ojo).

Espaciado:
   - Padding vertical de cada sección: clamp(48px, 8vw, 80-96px) — se achica solo en mobile sin necesidad de un breakpoint aparte, con margen lateral de al menos 20px en mobile.
   - Nunca menos de eso — es lo que da la sensación de nivel, no la cantidad de elementos.

Botones (píldora, no institucional-cuadrado — este es el cambio principal contra la versión anterior de este sistema):
   - Radius 100px (píldora completa) — es el estándar acá, no una excepción.
   - Alto ~46-48px, padding horizontal 24-26px, texto 14.5-15px weight 700.
   - Dos variantes: sólido (fondo del color oscuro/negro de la marca o el de acento, texto claro) y "ghost" (fondo transparente, borde 1.5px sutil, texto del color de marca) — usalas para primario/secundario, nunca dos botones sólidos compitiendo en la misma sección.
   - Hover: transform translateY(-1px), transición 0.15s ease — nada de escalarlo (scale) hacia arriba ni cambiar el radius.
   - El color de acento fuerte de la marca se usa en un solo lugar por sección real: el botón sólido, un ícono, o el degradado de texto. Ningún badge, card o título secundario compite con ese color al mismo tiempo que el CTA.

Tarjetas y bordes:
   - Radius grande: 16-20px en cards de contenido, 20-28px en la card del form del hero (cuanto más protagonista la card, más grande el radius).
   - Border 1px solid en un gris/tono muy sutil (no negro), sin sombra por defecto en cards simples.
   - La card del form del hero (o cualquier card "flotante" que deba separarse visualmente del fondo) sí puede llevar una sombra grande y suave: blur 60-70px, offset vertical alto (0 30px 70px), opacidad baja (~0.15-0.18) — es la única sombra grande permitida, y solo en el elemento más importante de la sección.
   - Una card "destacada" en un grid (el plan más elegido) se diferencia — elegí UNA sola de estas formas, no las combines todas en la misma card: (a) borde de degradado de 2px vía background-clip + badge flotante "Más elegido", (b) simplemente el botón sólido/oscuro en vez de ghost mientras el resto del grid usa ghost (así lo resuelve el ejemplo real que estás imitando, sin badge ni borde especial), o (c) fondo del color oscuro de la marca con texto claro mientras el resto son cards blancas. Si el grid tiene 4+ opciones como en el ejemplo, no hace falta que ninguna sea "la destacada" — pueden ser todas cards neutras del mismo peso, la jerarquía la da el orden y el copy, no un badge.
   - Inputs en focus: sin el outline feo del navegador, borde con el color de acento.

Fondos:
   - Tema claro por defecto (fondo general ~#faf9fd o el tono clarísimo equivalente de la paleta de marca, cards blancas) — es más premium y profesional para este rubro que un fondo oscuro por defecto. Un tema oscuro es una decisión válida solo si la marca lo pide explícitamente.
   - Textura de fondo sutil, fija (position: fixed, no se mueve con el scroll), en capas por debajo de todo el contenido (z-index negativo):
     · Un patrón geométrico repetido (hexágonos, puntos, líneas finas) al 4-6% de opacidad como textura base.
     · 1-2 formas circulares grandes (400-550px) de un color de acento de la marca, filter: blur(80-100px), opacity 0.12-0.18, ancladas en dos esquinas opuestas — esto NO es el glow prohibido de arriba porque no está pegado a ningún texto/imagen puntual, es ambiente de toda la página.
   - Alterná blanco/tono base y un gris clarísimo de sección a sección para separar sin necesitar una línea divisoria.
   - scroll-behavior: smooth en el html.

Nav fija:
   - position: sticky, top: 0, fondo semitransparente del tono base (~85% opacidad) + backdrop-filter: blur(10px), border-bottom 1px sutil.
   - Logo + nombre de marca a la izquierda, links a las secciones al centro/derecha (ocultos en mobile), botón CTA sólido a la derecha.

Mobile específico (además del padding de arriba):
   - CTA sticky: en viewport <= 768px, una barra fija al fondo (position: fixed, bottom 0) con el botón principal, fondo translúcido (rgba ~0.95 + backdrop-filter: blur — esta sí es la excepción funcional a la prohibición de glow de arriba, es funcional no decorativa), borde superior de 1px, y compensá con padding-bottom en el body para que no tape el final del contenido.
   - Los links de la nav se ocultan en mobile (no hace falta un menú hamburguesa a menos que el caso lo pida) — el logo y el botón CTA se mantienen.
   - Si el hero tiene alguna bajada secundaria además del subtítulo principal, ocultala en mobile (display: none) para que el form quede visible más arriba.
   - Si hay una franja de logos, en mobile mostrá máximo 3-4 (grid 2x2) y ocultá el resto — nada de una fila que obliga a scrollear horizontal o vertical de más sin aportar.
   - En las tarjetas de módulos/contenido, en mobile dejá solo título + el dato corto (duración, por ejemplo) y ocultá la descripción larga si la tenés.

Footer — esto es FIJO, no de diseño libre, ver el bloque literal más abajo que tenés que pegar tal cual.`;

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
 * OJO al tocar este prompt (como el fix del mensaje único de
 * "duplicado" de 2026-08-24 más arriba en HTML_BASE /
 * HTML_BASE_ENVIO_PERSONALIZADO): las filas de landing_templates que ya
 * están guardadas en la base NO se actualizan solas. html_content vive
 * copiado entero en cada fila de la tabla, no se referencia en vivo
 * desde este archivo — así que una plantilla generada con el prompt
 * viejo se queda con el HTML viejo (y su bug/gap ya arreglado acá)
 * hasta que alguien la vuelva a pegar a mano desde /admin/templates.
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
export function armarPromptPlantillaNueva(marca: Marca | null = null, envioPersonalizado: boolean = false) {
  const config = marca ? MARCAS[marca] : null;
  const htmlBase = envioPersonalizado ? HTML_BASE_ENVIO_PERSONALIZADO : HTML_BASE;

  // Sin marca fija: el estilo queda 100% a elección (comportamiento de
  // siempre). Con marca fija: paleta/tipografía/logos ya están
  // resueltos, no se le pregunta nada de eso — solo qué secciones
  // necesita y cómo se acomoda el layout con esa identidad.
  const bloqueEstilo = config
    ? `2. La landing es de la marca "${config.nombre}" — la identidad visual ya está resuelta, no me preguntes por colores, tipografía ni logo, usá EXACTAMENTE esto:

   Paleta de colores (usalos tal cual, no inventes otros ni los combines con colores nuevos):
   ${config.colores.join(', ')}
${config.degradado ? `   Degradado característico de la marca: ${config.degradado} — usalo donde un fondo con degradado tenga sentido (hero, botón principal, etc.), no es obligatorio en todos lados.\n` : ''}
   Tipografía: ${config.tipografiaPrincipal} para títulos, con ${config.tipografiasSecundarias.join(' / ')} como alternativas para el resto del texto. Si alguna de estas no está disponible en Google Fonts, elegí la alternativa gratuita de Google Fonts visualmente más parecida y decime en tu respuesta cuál elegiste y por qué — nunca uses una fuente de pago ni la cargues desde otro lado que no sea Google Fonts.

   Logos — usalos con estas rutas EXACTAS (son archivos reales ya subidos, nunca inventes una URL ni un data:URI, nunca los busques en otro lado):
   - Sobre fondo oscuro/de color: <img src="${config.logos.blanco}" alt="${config.nombre}">
   - Sobre fondo claro/blanco: <img src="${config.logos.negro}" alt="${config.nombre}">
   - Ícono/isotipo solo (favicon, badges, espacios chicos): <img src="${config.logos.isotipo}" alt="${config.nombre}">
${marca === 'one' ? `
   IMPORTANTE — ONE nunca va sola: se presenta siempre en conjunto con Escencial Argentina (es una alianza entre las dos marcas, no una marca aislada). En CUALQUIER lugar del diseño donde pongas la marca — header/nav, hero, badges, donde sea — poné SIEMPRE los dos logos juntos, con este llamado exacto (mismo orden, mismo alt, en todos lados, no lo varíes de una sección a otra):
   - Sobre fondo oscuro/de color: ${logosOneMasArgentina('blanco')}
   - Sobre fondo claro/blanco: ${logosOneMasArgentina('negro')}
   Orden: ONE primero (es la marca principal de esta landing), Escencial Argentina después — separados por un espacio chico o una línea divisoria fina y sutil, tamaño similar entre los dos (ninguno debe dominar visualmente al otro). Excepción: para el favicon o un isotipo suelto en un espacio chico, usá SOLO el isotipo de ONE — ahí no entran los dos logos juntos.
   El footer NO es parte de esto — es HTML fijo que te paso más abajo y que ya trae este mismo par de logos resuelto adentro, no se lo agregues vos ni lo dupliques ahí.
   La paleta de colores de TODA la landing sigue siendo la de ONE de arriba, nunca la de Escencial Argentina — lo único que se toma prestado de Argentina son sus logos, no sus colores.
` : ''}
   Contame igual qué referencia de estilo tenés en mente para el LAYOUT (moderno/minimalista/corporativo, cuánto espacio en blanco, alguna landing que te guste como referencia) — eso sigue siendo libre, lo único fijo es color/tipografía/logo.`
    : `2. Estilo/diseño visual: colores, referencia de marca, humor, alguna landing existente que te guste como referencia. Si no tengo nada específico, decime que uses cualquier estilo prolijo y moderno.

   No hay logo real para esta landing (no es una marca con archivo subido). Resolvé la marca en la nav/footer con un wordmark tipográfico — el nombre bien tipografiado, con el peso/tracking del sistema de diseño — nunca con un ícono inventado (cuadrado o círculo con degradado y un path SVG abstracto de líneas genéricas): eso es exactamente el patrón que más delata una landing hecha por IA, evitalo del todo.`;

  return `Necesito armar una plantilla de landing nueva para mi plataforma — esto es SOLO el diseño visual reutilizable. No es una campaña puntual: el nombre de la campaña, la asesora, el WhatsApp y el contenido de los emails de seguimiento se cargan después, en otro paso, cuando conecte esta plantilla a una campaña real. No me preguntes nada de eso.

Antes de generar nada, hacéme las preguntas 1 y 2 UNA POR UNA y esperá mi respuesta a cada una — el punto 3 no es una pregunta, es un sistema de diseño fijo, aplicalo directo:

1. Qué secciones necesita la landing (por ejemplo: hero con título/subtítulo/botón, beneficios o módulos, planes de precio, testimonios, preguntas frecuentes — el footer NO es parte de esta pregunta, es fijo, ver punto 3). Para cada sección que uses, decime qué campos van a cambiar de una campaña a otra — por ejemplo, en una sección de precios: ¿cuántos planes hay?, ¿cada uno tiene nombre + precio + texto de botón propio? Todavía no hace falta contenido real, eso se completa por campaña.
${envioPersonalizado ? `
   IMPORTANTE — esta plantilla es de "envío personalizado": el formulario del HTML base ya trae un <select name="opcion"> con 4 opciones fijas ({{opcion_1_texto}} a {{opcion_4_texto}}, más {{opcion_pregunta}} como el texto de la pregunta/label de ese select) — el LEAD elige una al registrarse, y esa elección decide cuál de los 4 emails de seguimiento configurados en la campaña se le manda (al instante, ninguno de los otros 3). No es una landing de goteo de emails: pensá el diseño de esta sección como "elegí qué te interesa" (por ejemplo 4 tarjetas o botones con el texto de cada opción, con el <select> real accesible aunque esté estilizado como otra cosa), no como un dropdown genérico perdido en el formulario — es una decisión central de la landing, dale protagonismo visual acorde.
` : ''}
${bloqueEstilo}

${SISTEMA_DISENO_LANDING}

Con esas respuestas y el sistema de diseño de arriba, generame el HTML completo de la plantilla. Partí EXACTAMENTE del HTML base de acá abajo — es la parte funcional real, ya probada (el formulario y el script que mandan los datos). NO toques los inputs, sus atributos "name", el input oculto "landing_id"${envioPersonalizado ? ', el <select name="opcion"> con sus 4 <option>' : ''}, ni el bloque <script>. Tampoco toques las etiquetas <meta name="description">, <meta property="og:..."> ni <meta name="twitter:..."> del <head> — son las que hacen que el link se vea bien al compartirlo y que Google entienda de qué trata la página; podés reordenar el <head> pero esas etiquetas (con sus {{titulo}}/{{subtitulo}} tal cual) tienen que seguir estando. Lo único que agregás es el diseño visual completo alrededor:
   - Meté todo el estilo en una etiqueta <style> propia, escrito a mano (CSS normal) — NADA de Tailwind por CDN ni ningún framework externo de CSS/JS: la landing tiene que cargar rápido para el lead que recién llega.
   - Si necesitás una tipografía distinta a la del sistema, podés importarla de Google Fonts en el <head> (con display=swap para que no haya parpadeo de texto invisible mientras carga).
   - Íconos: SVG inline si hacen falta, nunca una librería de íconos externa.
   - Cada campo de contenido que vaya a variar por campaña (título, precio, lo que sea) va como {{clave}} — elegí vos el nombre de cada clave, en minúsculas y sin espacios (ej: {{precio_plan_1}}). No hace falta declararlas en ningún lado aparte: el sistema las detecta solas apenas pegue este HTML en el panel.
   - Los placeholders {{titulo}}, {{subtitulo}}, {{boton_texto}} y el reservado {{__landing_id__}} ya vienen en el HTML base — podés mantenerlos, moverlos, o sacarlos y usar tus propias claves si el diseño no los necesita tal cual. Lo único que no se toca es la lógica del <form> y el <script>.
   - El footer va SIEMPRE al final, justo antes de </body> — es el bloque literal que te paso más abajo, pegalo TAL CUAL, sin cambiar ni un color, ni el texto, ni el spacing (ya viene con los logos de marca resueltos adentro si correspondía, no le agregues ni saques nada). No es parte del diseño libre de esta plantilla: es el pie institucional fijo de Escencial Consultora, va idéntico en todas las plantillas que genere, tenga la marca que tenga.

Dame DOS bloques, nada de explicaciones antes ni después:

A) El HTML completo, como se explicó arriba.

B) Un JSON válido (sin comentarios, sin texto alrededor) con una entrada por cada {{clave}} que hayas usado (excepto los reservados titulo/subtitulo/boton_texto/__landing_id__ si los dejaste tal cual, esos ya los conozco) — para cada una, un label corto en español y una descripción de una línea de QUÉ va ahí y en qué formato/tono, para que después, al crear una campaña con esta plantilla, se sepa exactamente qué escribir en cada campo sin tener que adivinar por el nombre de la clave:

{
  "precio_plan_1": { "label": "Precio del plan 1", "descripcion": "Precio con formato $X.XXX, sin decimales, ej: $49.999" },
  "faq_1_pregunta": { "label": "Pregunta 1 del FAQ", "descripcion": "Una pregunta frecuente real sobre el curso, corta, en tono cercano" }
}

HTML base (función fija, diseño libre):

\`\`\`html
${htmlBase}
\`\`\`

Footer institucional fijo (pegalo literal antes de </body>, no lo rediseñes ni le cambies el texto — ya trae su propio <style> con clases "efc-" que no van a chocar con el resto de tu CSS):

\`\`\`html
${footerEscencialHtml(marca)}
\`\`\`

Cómo lo voy a usar yo (no hace falta que hagas nada con esto, es solo contexto): el HTML (A) lo subo como plantilla nueva en el panel — el nombre interno de la plantilla, la categoría y la marca los cargo yo directo ahí, no hace falta que me los preguntes. El JSON (B) lo pego en el campo "Descripciones de variables" de esa misma pantalla — así el prompt que voy a copiar después, cuando cree una campaña con esta plantilla, ya sabe qué significa cada variable.`;
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

0. Pedime SIEMPRE, antes de cualquier otra pregunta, cualquier material real que tenga sobre este producto/servicio — folletos, lista de precios, programa/temario, capturas de la landing actual, un PDF, lo que sea. Nunca generes el JSON final solo a partir de lo que te cuento charlando en el chat, sin haber pedido esto primero — aunque te parezca que ya tenés suficiente.

1. Nombre interno de la campaña, para identificarla en el panel (ejemplo: "Liquidación Agosto 2026").

2. Nombre y WhatsApp de la asesora asignada. El número va en formato internacional, sin + ni espacios ni guiones (ejemplo: 5493815551234). Además, el texto que va a aparecer PRELLENADO en el WhatsApp del LEAD cuando haga click en el botón del email — un mensaje redactado en primera persona, como si el LEAD se lo estuviera escribiendo a la asesora (ejemplo: "Hola, quiero más info sobre la campaña"). OJO: esto NO es un aviso automático que el sistema le manda a la asesora — el sistema no manda WhatsApps por su cuenta. Lo único que hace es abrir el WhatsApp del lead con este texto ya escrito, listo para que él decida mandarlo.

3. Para cada uno de los hasta 4 emails de seguimiento que quieras activar (podés usar 1, 2, 3 o los 4 — el 1 es obligatorio, los demás se saltean solos si los dejás sin usar, no hace falta rellenar con texto tipo "N/A"):
   - Días después del registro en que se manda (0 = inmediato).
   - Asunto del email.
   - Contenido/speech de ese paso puntual.

4. El contenido real para cada uno de estos campos que tiene la plantilla de la landing que elegiste (nunca inventes vos el contenido de negocio, eso lo doy yo, o sale del material que pediste en el punto 0):
${listaVariables}

REGLA ANTI-INVENCIÓN — no la rompas nunca, ni "para completar": si para alguno de estos campos (sobre todo precios, fechas, programa/temario, cifras/estadísticas, datos de contacto) no tenés información real — ni en lo que te conté charlando, ni en el material que te pasé en el punto 0 — NO inventes un valor, y NO lo completes con un genérico tipo "Consultar", "Próximamente" o "A definir" sin avisarme antes. En vez de eso, frená y decime explícitamente qué campo(s) te quedaron sin cubrir y qué información puntual te falta para cada uno. Solo generá un valor estimado/inferido a partir del contexto y el material que sí te di si yo te lo pido expresamente Y te lo confirmo DOS VECES seguidas — preguntame primero algo como "¿confirmás que querés que infiera [campo] en base a [de dónde saldría]?" y necesitás mi "sí" dos veces antes de escribirlo. Nunca lo decidas por tu cuenta a la primera.

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
