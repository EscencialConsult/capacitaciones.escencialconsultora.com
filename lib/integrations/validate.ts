/**
 * Valida una API key contra el proveedor real ANTES de guardarla (pedido
 * explícito de Facundo, 2026-08-24, panel de Integraciones) — nunca se
 * guarda un secreto sin haber confirmado primero que el proveedor lo
 * acepta, para no dejar una key inválida guardada en silencio y que
 * recién se note el día que algo intenta mandar un email.
 *
 * Formato esperado de cada proveedor (chequeo rápido del lado del
 * servidor antes de gastar una llamada de red — mismo prefijo que
 * documentan Brevo/Resend en sus paneles):
 *   - Brevo: empieza con "xkeysib-"
 *   - Resend: empieza con "re_"
 */
export function formatoValido(proveedor: 'brevo' | 'resend', apiKey: string): boolean {
  if (proveedor === 'brevo') return apiKey.startsWith('xkeysib-');
  return apiKey.startsWith('re_');
}

export type ResultadoValidacion = { valida: true } | { valida: false; motivo: string };

/**
 * GET /v3/account — endpoint de solo lectura de Brevo, pensado
 * justamente para "¿esta key funciona?": cualquier key válida (sea cual
 * sea su nivel de permisos) responde 200 con los datos de la cuenta.
 * 401 = key inválida o revocada.
 */
async function validarBrevo(apiKey: string): Promise<ResultadoValidacion> {
  try {
    const respuesta = await fetch('https://api.brevo.com/v3/account', {
      headers: { 'api-key': apiKey, accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });

    if (respuesta.ok) return { valida: true };
    if (respuesta.status === 401) {
      return { valida: false, motivo: 'La clave API no es válida o ha sido revocada. Por favor, generá una nueva.' };
    }
    return { valida: false, motivo: `Brevo respondió ${respuesta.status} — no se pudo confirmar que la clave sea válida.` };
  } catch {
    return { valida: false, motivo: 'No se pudo contactar a Brevo para validar la clave. Probá de nuevo en un momento.' };
  }
}

/**
 * Bug real confirmado (2026-08-24) — la versión anterior usaba GET
 * /domains como sonda, asumiendo que una key "Sending access" (menos
 * permisos que "Full access") daría 403 ahí en vez de 401, y que 403
 * significaba "válida pero sin permiso para ESTA operación puntual".
 * Probado en vivo contra una key real recién creada con "Sending
 * access": Resend responde **401** en /domains y en /api-keys para
 * CUALQUIER key restringida a solo-envío, con el mensaje "This API key
 * is restricted to only send emails" — no 403. Con la sonda vieja,
 * cualquier key "Sending access" (la opción que las propias
 * instrucciones de este panel recomiendan como válida) quedaba
 * rechazada como "inválida o revocada", que era mentira.
 *
 * Fix: usar POST /emails con las direcciones de sandbox que el propio
 * Resend documenta para testing (`onboarding@resend.dev` →
 * `delivered@resend.dev`) — no requiere dominio verificado, no le
 * llega a ninguna persona real, y funciona con CUALQUIER nivel de
 * permiso (es exactamente la operación para la que existe una key de
 * "Sending access"). Confirmado en vivo: 200 con una key válida
 * (cualquier permiso), 401 con mensaje "API key is invalid" con una
 * key inventada.
 */
async function validarResend(apiKey: string): Promise<ResultadoValidacion> {
  try {
    const respuesta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: ['delivered@resend.dev'],
        subject: 'Validación de conexión — Panel de Integraciones',
        text: 'Email de prueba automático para confirmar que la API key funciona. No requiere ninguna acción.',
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (respuesta.ok) return { valida: true };
    if (respuesta.status === 401) {
      return { valida: false, motivo: 'La clave API no es válida o ha sido revocada. Por favor, generá una nueva.' };
    }
    return { valida: false, motivo: `Resend respondió ${respuesta.status} — no se pudo confirmar que la clave sea válida.` };
  } catch {
    return { valida: false, motivo: 'No se pudo contactar a Resend para validar la clave. Probá de nuevo en un momento.' };
  }
}

export async function validarApiKey(proveedor: 'brevo' | 'resend', apiKey: string): Promise<ResultadoValidacion> {
  return proveedor === 'brevo' ? validarBrevo(apiKey) : validarResend(apiKey);
}
