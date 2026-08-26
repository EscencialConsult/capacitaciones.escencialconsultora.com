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

  try {
    const resultado = await processPendingEmails();
    console.log('process-pending-emails-background:', resultado);
    return new Response(JSON.stringify(resultado), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    // Bug real reportado (2026-08-26) — un envío quedaba en 'processing'
    // para siempre, sin error ni éxito, y no había NINGÚN rastro de por
    // qué: una excepción sin capturar en processPendingEmails() mataba
    // toda la función en silencio (Netlify no manda esto a ningún lado
    // que el panel pueda leer). Este catch es la diferencia entre "no
    // sabemos qué pasó" y un mensaje real en /admin (vía system_alerts).
    const mensaje = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
    console.error('process-pending-emails-background: excepción no capturada:', mensaje);
    const { createSupabaseServiceClient } = await import('../../lib/supabase/server');
    const supabase = createSupabaseServiceClient();
    await supabase.from('system_alerts').upsert(
      { source: 'email_background_crash', message: mensaje, last_seen_at: new Date().toISOString(), resolved_at: null },
      { onConflict: 'source' }
    );
    return new Response(null, { status: 500 });
  }
};
