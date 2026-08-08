/**
 * Code.gs — Sistema de Landing Automatizada con Envío de Emails
 *
 * TODO el proyecto vive en un solo archivo y usa UNA SOLA pestaña de
 * Google Sheets (llamada "Datos"), dividida en dos bloques de columnas
 * que crecen de forma independiente:
 *
 *   Columnas A:Q   → bloque LEADS (una fila por persona que entra a la landing)
 *   Columna  R     → separador visual, se deja vacía a propósito
 *   Columnas S:AM  → bloque CONFIG_CAMPAÑAS (una fila por campaña, la carga Facundo a mano)
 *
 * Por qué dos bloques de columnas y no todo mezclado en una sola tabla:
 * Leads y Config_Campañas tienen una fila por cosas distintas (una persona
 * vs. una campaña completa) y crecen a ritmos distintos. Separarlos en
 * columnas de la MISMA pestaña permite tener todo en un solo lugar sin
 * duplicar la configuración de la campaña en cada fila de lead — así se
 * edita un template una sola vez, no en cada lead.
 *
 * Los errores de envío NO van a una hoja de "Logs" aparte (para no sumar
 * una tercera pestaña): se ven en Apps Script > Ejecuciones, y además el
 * estado_N de la fila afectada queda marcado "error" para saber cuál falló.
 *
 * El dashboard (dashboard/index.html, publicado en /dashboard del sitio)
 * NO vive acá — es una página estática aparte que le pide los datos a
 * este mismo Web App vía doGet(?vista=dashboard&clave=...) y los pinta
 * del lado del cliente. Así "/dashboard" puede ser una ruta real del
 * dominio publicado, aunque Apps Script no soporte rutas propias.
 *
 * Ver docs/setup-sheets.md para la fila de encabezados lista para copiar.
 */

// ── Configuración ──────────────────────────────────────────────

const SHEET_NAME = 'Datos';

const LEADS_COL_INICIO = 1;   // columna A
const LEADS_COL_FIN = 17;     // columna Q

const CONFIG_COL_INICIO = 19; // columna S (la R queda vacía como separador)
const CONFIG_COL_FIN = 39;    // columna AM

const MAX_PASOS = 4;

function getScriptProp_(key) {
  const value = PropertiesService.getScriptProperties().getProperty(key);
  if (!value) {
    throw new Error(
      'Falta configurar la propiedad "' + key + '". ' +
      'Extensiones > Apps Script > Configuración del proyecto > Propiedades del script.'
    );
  }
  return value;
}

function getBrevoApiKey() { return getScriptProp_('BREVO_API_KEY'); }
function getSenderEmail() { return getScriptProp_('SENDER_EMAIL'); }
function getSenderName() { return getScriptProp_('SENDER_NAME'); }
function getWebAppUrl() { return getScriptProp_('WEBAPP_URL'); }
function getDashboardSecret() { return getScriptProp_('DASHBOARD_SECRET'); }

function getSheet_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    throw new Error('No existe la pestaña "' + SHEET_NAME + '". Ver docs/setup-sheets.md.');
  }
  return sheet;
}

// ── Helpers de lectura/escritura por bloque de columnas ─────────

/**
 * Lee un bloque de columnas dentro de la pestaña única. Devuelve:
 *   idx   → {nombreColumna: índice relativo 0-based DENTRO del bloque}
 *   filas → matriz de valores, ya recortada (sin las filas vacías de más
 *           que arrastra getLastRow() por culpa de que el OTRO bloque
 *           tenga más filas cargadas).
 */
function leerBloque_(sheet, colInicio, colFin) {
  const ancho = colFin - colInicio + 1;
  const headers = sheet.getRange(1, colInicio, 1, ancho).getValues()[0];
  const idx = {};
  headers.forEach(function (h, i) { idx[String(h).trim()] = i; });

  const ultimaFilaGlobal = sheet.getLastRow();
  var filas = [];

  if (ultimaFilaGlobal >= 2) {
    var rango = sheet.getRange(2, colInicio, ultimaFilaGlobal - 1, ancho).getValues();
    var ultimaConDatos = -1;
    for (var i = rango.length - 1; i >= 0; i--) {
      if (rango[i].some(function (v) { return v !== '' && v !== null; })) {
        ultimaConDatos = i;
        break;
      }
    }
    filas = rango.slice(0, ultimaConDatos + 1);
  }

  return { idx: idx, filas: filas };
}

function agregarFilaLeads_(sheet, fila) {
  const bloque = leerBloque_(sheet, LEADS_COL_INICIO, LEADS_COL_FIN);
  const filaAbsolutaDestino = 2 + bloque.filas.length; // primera fila libre DEL BLOQUE LEADS, no de la hoja entera
  const ancho = LEADS_COL_FIN - LEADS_COL_INICIO + 1;
  const nuevaFila = new Array(ancho).fill('');

  Object.keys(fila).forEach(function (key) {
    if (bloque.idx[key] !== undefined) {
      nuevaFila[bloque.idx[key]] = fila[key];
    }
  });

  sheet.getRange(filaAbsolutaDestino, LEADS_COL_INICIO, 1, ancho).setValues([nuevaFila]);
}

function marcarCelda_(sheet, colInicioBloque, filaAbsoluta, idxRelativo, valor) {
  sheet.getRange(filaAbsoluta, colInicioBloque + idxRelativo, 1, 1).setValue(valor);
}

function findConfigRow_(sheet, origenCampaña) {
  const bloque = leerBloque_(sheet, CONFIG_COL_INICIO, CONFIG_COL_FIN);
  const colOrigen = bloque.idx['origen_campaña'];

  for (var i = 0; i < bloque.filas.length; i++) {
    if (bloque.filas[i][colOrigen] === origenCampaña) {
      var row = {};
      Object.keys(bloque.idx).forEach(function (h) { row[h] = bloque.filas[i][bloque.idx[h]]; });
      return row;
    }
  }
  return null;
}

function emailYaRegistrado_(sheet, origenCampaña, email) {
  const bloque = leerBloque_(sheet, LEADS_COL_INICIO, LEADS_COL_FIN);
  const colEmail = bloque.idx['email'];
  const colOrigen = bloque.idx['origen_campaña'];

  for (var i = 0; i < bloque.filas.length; i++) {
    if (bloque.filas[i][colOrigen] === origenCampaña &&
        String(bloque.filas[i][colEmail]).toLowerCase() === String(email).toLowerCase()) {
      return true;
    }
  }
  return false;
}

function reemplazarPlaceholders_(html, valores) {
  var resultado = html;
  Object.keys(valores).forEach(function (key) {
    var regex = new RegExp('{{' + key + '}}', 'g');
    resultado = resultado.replace(regex, valores[key] != null ? valores[key] : '');
  });
  return resultado;
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Script A — Receptor (doPost) ─────────────────────────────────
// Recibe el formulario de la landing, calcula el calendario de hasta
// 4 envíos según el bloque Config_Campañas, y agrega la fila en el
// bloque Leads. Nunca envía nada — solo agenda.

function doPost(e) {
  try {
    const sheet = getSheet_();
    const params = e.parameter;
    const origenCampaña = params['origen_campaña'];
    const email = params.email;

    if (!origenCampaña || !email) {
      return jsonResponse_({ ok: false, error: 'Faltan campos obligatorios (origen_campaña, email).' });
    }

    const config = findConfigRow_(sheet, origenCampaña);
    if (!config) {
      return jsonResponse_({ ok: false, error: 'La campaña "' + origenCampaña + '" no existe en el bloque Config_Campañas.' });
    }
    if (config.activa !== true && String(config.activa).toUpperCase() !== 'TRUE') {
      return jsonResponse_({ ok: false, error: 'La campaña "' + origenCampaña + '" está inactiva.' });
    }

    if (emailYaRegistrado_(sheet, origenCampaña, email)) {
      return jsonResponse_({ ok: true, duplicado: true });
    }

    const leadId = Utilities.getUuid();
    const ahora = new Date();

    const fila = {
      'lead_id': leadId,
      'timestamp': ahora,
      'origen_campaña': origenCampaña,
      'nombre': params.nombre || '',
      'apellido': params.apellido || '',
      'email': email,
      'datos_extra': params.datos_extra || '',
      'contacto_confirmado_fecha': '',
      'contacto_confirmado_paso': ''
    };

    // Las 4 fechas se calculan una sola vez acá, tomando como base el
    // momento de captura. El lead arrastra su propio calendario para
    // siempre, sin importar qué cambie después en Config_Campañas.
    for (var n = 1; n <= MAX_PASOS; n++) {
      var tieneTemplate = config['template_base_' + n] && String(config['template_base_' + n]).trim() !== '';
      if (tieneTemplate) {
        var fechaEnvio = new Date(ahora.getTime());
        fechaEnvio.setDate(fechaEnvio.getDate() + Number(config['offset_dias_' + n] || 0));
        fila['fecha_envio_' + n] = fechaEnvio;
        fila['estado_' + n] = 'pendiente';
      } else {
        fila['fecha_envio_' + n] = '';
        fila['estado_' + n] = 'n/a';
      }
    }

    agregarFilaLeads_(sheet, fila);

    return jsonResponse_({ ok: true, lead_id: leadId });
  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message });
  }
}

// ── Script B — Enviador (trigger horario) ────────────────────────
// Recorre el bloque Leads buscando envíos que ya deberían salir hoy
// y llama a la API de Brevo. Separado del Receptor a propósito: si
// el envío falla o tarda, la captura de leads nunca se ve afectada.

function enviarPendientes() {
  const sheet = getSheet_();
  const bloque = leerBloque_(sheet, LEADS_COL_INICIO, LEADS_COL_FIN);
  const ahora = new Date();
  const configCache = {}; // evita releer el bloque Config_Campañas por cada fila de Leads

  for (var i = 0; i < bloque.filas.length; i++) {
    var fila = bloque.filas[i];
    var filaAbsoluta = i + 2;
    var origenCampaña = fila[bloque.idx['origen_campaña']];

    for (var n = 1; n <= MAX_PASOS; n++) {
      var estado = fila[bloque.idx['estado_' + n]];
      var fechaEnvio = fila[bloque.idx['fecha_envio_' + n]];

      if (estado !== 'pendiente') continue;
      if (!fechaEnvio || new Date(fechaEnvio) > ahora) continue;

      try {
        if (!(origenCampaña in configCache)) {
          configCache[origenCampaña] = findConfigRow_(sheet, origenCampaña);
        }
        var config = configCache[origenCampaña];

        if (!config) {
          marcarCelda_(sheet, LEADS_COL_INICIO, filaAbsoluta, bloque.idx['estado_' + n], 'error');
          console.error('Campaña no encontrada: ' + origenCampaña + ' (lead ' + fila[bloque.idx['lead_id']] + ', paso ' + n + ')');
          continue;
        }

        enviarPaso_(config, fila, bloque.idx, n);
        marcarCelda_(sheet, LEADS_COL_INICIO, filaAbsoluta, bloque.idx['estado_' + n], 'enviado');
      } catch (err) {
        marcarCelda_(sheet, LEADS_COL_INICIO, filaAbsoluta, bloque.idx['estado_' + n], 'error');
        console.error('Error enviando paso ' + n + ' a lead ' + fila[bloque.idx['lead_id']] + ': ' + err.message);
      }
    }
  }
}

function enviarPaso_(config, fila, idx, n) {
  const templateUrl = config['template_base_' + n];
  const contenido = config['contenido_' + n];
  const asunto = config['asunto_' + n];

  const respTemplate = UrlFetchApp.fetch(templateUrl, { muteHttpExceptions: true });
  if (respTemplate.getResponseCode() !== 200) {
    throw new Error('No se pudo descargar el template (' + respTemplate.getResponseCode() + '): ' + templateUrl);
  }
  const html = respTemplate.getContentText();

  const leadId = fila[idx['lead_id']];
  const whatsappUrl = getWebAppUrl() + '?id=' + encodeURIComponent(leadId) + '&paso=' + n;

  const htmlFinal = reemplazarPlaceholders_(html, {
    nombre: fila[idx['nombre']],
    apellido: fila[idx['apellido']],
    contenido: contenido,
    whatsapp_url: whatsappUrl,
    asesora_nombre: config['asesora_nombre']
  });

  enviarEmailBrevo_(fila[idx['email']], asunto, htmlFinal);
}

/** Llama a la API transaccional de Brevo. https://api.brevo.com/v3/smtp/email */
function enviarEmailBrevo_(destinatarioEmail, asunto, htmlContent) {
  const payload = {
    sender: { name: getSenderName(), email: getSenderEmail() },
    to: [{ email: destinatarioEmail }],
    subject: asunto,
    htmlContent: htmlContent
  };

  const response = UrlFetchApp.fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'api-key': getBrevoApiKey(),
      'accept': 'application/json'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const codigo = response.getResponseCode();
  if (codigo < 200 || codigo >= 300) {
    throw new Error('Brevo respondió ' + codigo + ': ' + response.getContentText());
  }
}

/**
 * Crea el trigger horario. Correr UNA VEZ manualmente desde el editor
 * (seleccionar esta función y tocar "Ejecutar"). No hace falta repetirlo
 * salvo que borres el trigger a mano desde ⏰ Activadores.
 */
function crearTriggerHorario() {
  ScriptApp.newTrigger('enviarPendientes')
    .timeBased()
    .everyHours(1)
    .create();
}

// ── Script C — Tracker de contacto + Dashboard (doGet) ───────────
// Un solo doGet, dos usos según el parámetro que llegue:
//   ?id=...&paso=...      → Tracker: click de WhatsApp del email (Script C)
//   ?vista=dashboard&clave=... → Dashboard: devuelve JSON con el estado
//                                de las campañas, lo consume dashboard/index.html
// Vive en el mismo Web App/deploy que el Receptor — Apps Script permite
// doGet y doPost en el mismo proyecto sin problema.

function doGet(e) {
  if (e.parameter.vista === 'dashboard') {
    return handleDashboard_(e);
  }
  return handleTrackerClick_(e);
}

/**
 * Devuelve el resumen de campañas en JSON. Protegido con una clave
 * (Propiedad del script DASHBOARD_SECRET) para que no cualquiera que
 * adivine "?vista=dashboard" vea los datos de los leads — el Web App
 * está deployado con acceso "Cualquier usuario" porque lo necesitan la
 * landing y el tracker, así que esta es la única traba que tiene el
 * dashboard. No es una autenticación fuerte, pero alcanza para que no
 * quede la info abierta a cualquiera que pase por la URL.
 */
function handleDashboard_(e) {
  var claveEsperada;
  try {
    claveEsperada = getDashboardSecret();
  } catch (err) {
    return jsonResponse_({ ok: false, error: 'Falta configurar DASHBOARD_SECRET en Propiedades del script.' });
  }

  if (!e.parameter.clave || e.parameter.clave !== claveEsperada) {
    return jsonResponse_({ ok: false, error: 'No autorizado.' });
  }

  return jsonResponse_({ ok: true, campañas: obtenerResumenCampañas_() });
}

/** Arma, por cada fila de Config_Campañas, el conteo de leads y estados de esa campaña. */
function obtenerResumenCampañas_() {
  const sheet = getSheet_();
  const bloqueLeads = leerBloque_(sheet, LEADS_COL_INICIO, LEADS_COL_FIN);
  const bloqueConfig = leerBloque_(sheet, CONFIG_COL_INICIO, CONFIG_COL_FIN);

  const resumenPorCampaña = {};

  bloqueLeads.filas.forEach(function (fila) {
    var campaña = fila[bloqueLeads.idx['origen_campaña']];
    if (!campaña) return;

    if (!resumenPorCampaña[campaña]) {
      resumenPorCampaña[campaña] = {
        total: 0,
        confirmados: 0,
        pasos: {
          1: { pendiente: 0, enviado: 0, error: 0, 'n/a': 0 },
          2: { pendiente: 0, enviado: 0, error: 0, 'n/a': 0 },
          3: { pendiente: 0, enviado: 0, error: 0, 'n/a': 0 },
          4: { pendiente: 0, enviado: 0, error: 0, 'n/a': 0 }
        }
      };
    }

    var r = resumenPorCampaña[campaña];
    r.total++;
    if (fila[bloqueLeads.idx['contacto_confirmado_fecha']]) r.confirmados++;

    for (var n = 1; n <= MAX_PASOS; n++) {
      var estado = fila[bloqueLeads.idx['estado_' + n]] || 'n/a';
      if (r.pasos[n][estado] === undefined) r.pasos[n][estado] = 0;
      r.pasos[n][estado]++;
    }
  });

  return bloqueConfig.filas
    .map(function (fila) {
      var campaña = fila[bloqueConfig.idx['origen_campaña']];
      if (!campaña) return null; // fila vacía del bloque, no es una campaña real

      return {
        origen_campaña: campaña,
        activa: String(fila[bloqueConfig.idx['activa']]).toUpperCase() === 'TRUE',
        asesora_nombre: fila[bloqueConfig.idx['asesora_nombre']] || '',
        total_leads: (resumenPorCampaña[campaña] || { total: 0 }).total,
        confirmados_whatsapp: (resumenPorCampaña[campaña] || { confirmados: 0 }).confirmados,
        pasos: (resumenPorCampaña[campaña] || { pasos: {} }).pasos
      };
    })
    .filter(function (c) { return c !== null; });
}

function handleTrackerClick_(e) {
  const leadId = e.parameter.id;
  const paso = e.parameter.paso || '';

  if (!leadId) {
    return HtmlService.createHtmlOutput('Falta el parámetro id.');
  }

  const sheet = getSheet_();
  const bloque = leerBloque_(sheet, LEADS_COL_INICIO, LEADS_COL_FIN);

  var filaIndex = -1;
  var origenCampaña = '';

  for (var i = 0; i < bloque.filas.length; i++) {
    if (bloque.filas[i][bloque.idx['lead_id']] === leadId) {
      filaIndex = i;
      origenCampaña = bloque.filas[i][bloque.idx['origen_campaña']];
      break;
    }
  }

  if (filaIndex === -1) {
    return HtmlService.createHtmlOutput('Link inválido o vencido.');
  }

  var filaAbsoluta = filaIndex + 2;

  // Solo se completa la primera vez: si ya había un click registrado, no se pisa.
  if (!bloque.filas[filaIndex][bloque.idx['contacto_confirmado_fecha']]) {
    marcarCelda_(sheet, LEADS_COL_INICIO, filaAbsoluta, bloque.idx['contacto_confirmado_fecha'], new Date());
    marcarCelda_(sheet, LEADS_COL_INICIO, filaAbsoluta, bloque.idx['contacto_confirmado_paso'], paso);
  }

  const config = findConfigRow_(sheet, origenCampaña);
  const numero = config ? config['asesora_whatsapp'] : '';
  const mensaje = config ? config['mensaje_whatsapp'] : '';
  const urlWhatsapp = 'https://wa.me/' + numero + '?text=' + encodeURIComponent(mensaje || '');

  const html = '<html><head>' +
    '<meta http-equiv="refresh" content="0; url=' + urlWhatsapp + '">' +
    '<script>window.location.href = ' + JSON.stringify(urlWhatsapp) + ';</script>' +
    '</head><body>Redirigiendo a WhatsApp…</body></html>';

  return HtmlService.createHtmlOutput(html);
}

// ── Menú de la planilla: botón "Colocar encabezados" ─────────────
// onOpen() se ejecuta solo cada vez que abrís la planilla en el navegador
// (no hace falta correrlo a mano) y agrega un menú propio arriba de todo,
// al lado de "Ayuda". Sirve para (re)generar los encabezados de los dos
// bloques con el formato correcto sin copiar/pegar el texto con tabs.

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚙️ Sistema Landing')
    .addItem('Colocar encabezados', 'colocarEncabezados')
    .addToUi();
}

function colocarEncabezados() {
  var sheet;
  try {
    sheet = getSheet_();
  } catch (err) {
    SpreadsheetApp.getUi().alert('Creá primero una pestaña llamada "' + SHEET_NAME + '" y volvé a tocar el botón.');
    return;
  }

  const encabezadosLeads = [
    'lead_id', 'timestamp', 'origen_campaña', 'nombre', 'apellido', 'email',
    'datos_extra', 'fecha_envio_1', 'estado_1', 'fecha_envio_2', 'estado_2',
    'fecha_envio_3', 'estado_3', 'fecha_envio_4', 'estado_4',
    'contacto_confirmado_fecha', 'contacto_confirmado_paso'
  ];

  const encabezadosConfig = [
    'origen_campaña', 'asesora_nombre', 'asesora_whatsapp', 'mensaje_whatsapp',
    'offset_dias_1', 'template_base_1', 'contenido_1', 'asunto_1',
    'offset_dias_2', 'template_base_2', 'contenido_2', 'asunto_2',
    'offset_dias_3', 'template_base_3', 'contenido_3', 'asunto_3',
    'offset_dias_4', 'template_base_4', 'contenido_4', 'asunto_4',
    'activa'
  ];

  escribirEncabezados_(sheet, LEADS_COL_INICIO, encabezadosLeads);
  escribirEncabezados_(sheet, CONFIG_COL_INICIO, encabezadosConfig);
  sheet.setFrozenRows(1);

  SpreadsheetApp.getUi().alert('Listo — encabezados colocados en la pestaña "' + SHEET_NAME + '".');
}

/** Escribe una fila de encabezados en la fila 1, con fondo negro y letra blanca en negrita. */
function escribirEncabezados_(sheet, colInicio, encabezados) {
  const rango = sheet.getRange(1, colInicio, 1, encabezados.length);
  rango.setValues([encabezados]);
  rango.setBackground('#000000');
  rango.setFontColor('#ffffff');
  rango.setFontWeight('bold');
}
