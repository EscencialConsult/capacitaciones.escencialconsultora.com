import { processPendingEmails } from '../../lib/email/process-pending';

/**
 * El trabajo real vive acá, no en send-pending-emails.ts (2026-08-26,
 * bug real confirmado) — las funciones programadas (`schedule`) de
 * Netlify tienen un límite DURO de 30 segundos, sin excepción. Con más
 * de un par de emails pendientes en el mismo ciclo (cada uno con su
 * propia red de reintentos con backoff), el envío se cortaba a mitad
 * de camino: quedaban filas en 'processing' para siempre, sin error
 * ni éxito, porque Netlify mataba la función antes de que el
 * try/catch de process-pending.ts llegara a terminar. Patrón oficial
 * de Netlify para esto: la función programada solo DISPARA esta
 * función "background" (nombre terminado en -background, hasta 15
 * minutos de límite) y termina al toque — el trabajo pesado sigue acá,
 * en paralelo, sin el techo de 30s.
 *
 * Protegida con un secreto compartido (INTERNAL_FUNCTION_SECRET) — a
 * diferencia de una función programada (que Netlify invoca sola, sin
 * exponer la URL a nadie), esta SÍ tiene una URL pública alcanzable
 * por cualquiera que la adivine; sin este chequeo, cualquiera podría
 * dispararla a mano y forzar un ciclo de envío fuera de horario.
 *
 * "Background function" por el sufijo -background del NOMBRE del
 * archivo (convención que @netlify/functions@2.8 todavía soporta) —
 * la propiedad `config.background` es de una versión más nueva del
 * paquete que la instalada acá, no hizo falta actualizar solo por esto.
 */
export default async (req: Request) => {
  const secreto = req.headers.get('x-internal-secret');
  if (!secreto || secreto !== process.env.INTERNAL_FUNCTION_SECRET) {
    return new Response(null, { status: 403 });
  }

  const resultado = await processPendingEmails();
  console.log('process-pending-emails-background:', resultado);
  return new Response(JSON.stringify(resultado), {
    headers: { 'content-type': 'application/json' },
  });
};
