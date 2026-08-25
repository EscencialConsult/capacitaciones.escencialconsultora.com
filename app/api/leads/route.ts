import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { leadInputSchema } from '@/lib/leads';

/**
 * Rate limiting del POST público (bug real confirmado 2026-08-24, ver
 * supabase/migrations/0015_rate_limit_y_registro_lead_atomico.sql). Sin
 * esto, cualquiera que scrapee un landing_id de una landing pública
 * podía scriptear miles de POST con el email de una víctima — email
 * bombing sobre el dominio de envío de Escencial, sin ningún 429,
 * CAPTCHA ni honeypot de por medio.
 *
 * El freno por IP es GLOBAL (cruza landings) para que un atacante no lo
 * esquive repartiendo el mismo volumen entre varios landing_id reales.
 * El freno por email sí se acota a la landing puntual, para no
 * bloquear a alguien que legítimamente se anota en más de una campaña
 * real distinta. También limita el "oráculo de duplicado" (bug real
 * confirmado 2026-08-24: la respuesta distingue duplicado:true de un
 * alta nueva) — capa drásticamente cuántos emails se pueden probar por
 * minuto/día contra una landing dada.
 */
const LIMITE_IP_VENTANA_MS = 60_000; // 1 minuto
const LIMITE_IP_MAXIMO = 5;
const LIMITE_EMAIL_VENTANA_MS = 24 * 60 * 60 * 1000; // 1 día
const LIMITE_EMAIL_MAXIMO = 3;

async function estaLimitadoPorRate(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  kind: 'ip' | 'email',
  key: string,
  landingId: string,
  ventanaMs: number,
  maximo: number
): Promise<boolean> {
  const desde = new Date(Date.now() - ventanaMs).toISOString();
  let query = supabase
    .from('rate_limit_events')
    .select('id', { count: 'exact', head: true })
    .eq('kind', kind)
    .eq('key', key)
    .gte('created_at', desde);
  // El freno por IP es global (ver comentario de arriba); el de email
  // sí se acota a esta landing puntual.
  if (kind === 'email') {
    query = query.eq('landing_id', landingId);
  }
  const { count, error } = await query;

  if (error) {
    // rate_limit_events es de la migración 0015 — si todavía no se
    // aplicó a la base real, esto va a errorear siempre. Fail-open a
    // propósito: un fallo acá no puede tumbar la captura de leads real,
    // que es el flujo que importa. Se loguea para no perder rastro.
    console.error(`Error chequeando rate limit (${kind}):`, error);
    return false;
  }
  if ((count ?? 0) >= maximo) {
    return true;
  }

  const { error: insertError } = await supabase
    .from('rate_limit_events')
    .insert({ kind, key, landing_id: landingId });
  if (insertError) {
    console.error(`Error registrando evento de rate limit (${kind}):`, insertError);
  }
  return false;
}

function obtenerIpCliente(request: Request): string {
  // Netlify inyecta este header con la IP real del cliente, verificada
  // en su borde — a diferencia de x-forwarded-for, el visitante no
  // puede falsificarlo agregando su propio header a mano. Se usa como
  // fuente primaria; el resto son fallback para dev local u otro host.
  const ipNetlify = request.headers.get('x-nf-client-connection-ip');
  if (ipNetlify) return ipNetlify;
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'ip-desconocida';
}

/**
 * Reemplazo de doPost (Script A del sistema viejo). Público — cualquier
 * landing manda acá su formulario. Usa el cliente con service role
 * porque no hay sesión de usuario logueado (el visitante de la landing
 * no es Facundo), y la tabla `leads` no tiene policies públicas de RLS
 * a propósito — este endpoint YA validó todo lo necesario a mano antes
 * de escribir.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Body inválido.' }, { status: 400 });
  }

  const parsed = leadInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' },
      { status: 400 }
    );
  }
  const { landing_id, nombre, apellido, email, phone, opcion } = parsed.data;

  const supabase = createSupabaseServiceClient();

  // Se corta acá mismo, antes de gastar ninguna query contra
  // landings/campaigns/leads — landing_id no hace falta que exista de
  // verdad para este chequeo (ver por qué rate_limit_events.landing_id
  // no es FK, en la migración 0015): un landing_id inventado no puede
  // esquivar el freno.
  const ip = obtenerIpCliente(request);
  if (await estaLimitadoPorRate(supabase, 'ip', ip, landing_id, LIMITE_IP_VENTANA_MS, LIMITE_IP_MAXIMO)) {
    return NextResponse.json(
      { ok: false, error: 'Demasiados intentos. Probá de nuevo en un minuto.' },
      { status: 429 }
    );
  }
  if (
    await estaLimitadoPorRate(
      supabase,
      'email',
      email.toLowerCase(),
      landing_id,
      LIMITE_EMAIL_VENTANA_MS,
      LIMITE_EMAIL_MAXIMO
    )
  ) {
    return NextResponse.json(
      { ok: false, error: 'Demasiados intentos con este email. Probá de nuevo más tarde.' },
      { status: 429 }
    );
  }

  // `landing_id` es el contrato público (el <form> de cada plantilla ya
  // creada lo manda así, ver {{__landing_id__}}) — pero el lead se
  // guarda contra la CAMPAÑA activa de esa landing, no contra la
  // landing directo (ver 0004_separar_campanas_de_landings.sql).
  // Se trae también landing_templates.envio_personalizado porque decide
  // TODA la lógica de agendado de más abajo — ver el comentario ahí.
  const { data: landing, error: landingError } = await supabase
    .from('landings')
    .select('id, is_active, landing_templates(envio_personalizado)')
    .eq('id', landing_id)
    .single();

  if (landingError || !landing) {
    return NextResponse.json({ ok: false, error: 'La landing no existe.' }, { status: 404 });
  }
  if (!landing.is_active) {
    return NextResponse.json({ ok: false, error: 'Esta landing no está activa.' }, { status: 409 });
  }

  const template = landing.landing_templates as unknown as { envio_personalizado: boolean } | null;
  const esEnvioPersonalizado = template?.envio_personalizado ?? false;

  if (esEnvioPersonalizado && !opcion) {
    return NextResponse.json(
      { ok: false, error: 'Falta elegir una opción.' },
      { status: 400 }
    );
  }

  const { data: campana, error: campanaError } = await supabase
    .from('campaigns')
    .select('id')
    .eq('landing_id', landing_id)
    .eq('status', 'active')
    .maybeSingle();

  if (campanaError || !campana) {
    return NextResponse.json(
      { ok: false, error: 'Esta landing no tiene ninguna campaña activa en este momento.' },
      { status: 409 }
    );
  }

  // Se trae ACÁ (antes de insertar el lead) y no más abajo como antes,
  // para poder validar en envío personalizado que la opción elegida
  // tenga de verdad un paso activo cargado — después se reusa esta
  // misma variable para agendar el/los envío/s, sin volver a consultar.
  const { data: steps, error: stepsError } = await supabase
    .from('landing_email_steps')
    .select('id, step_number, offset_days')
    .eq('campaign_id', campana.id)
    .eq('is_active', true);

  if (stepsError) {
    console.error('Error leyendo landing_email_steps:', stepsError);
  }

  // Bugfix (2026-08-24): el <select> de HTML_BASE_ENVIO_PERSONALIZADO
  // siempre renderiza las 4 opciones fijas y con required, pero el admin
  // puede haber dejado alguna sin cargar (parsePasos() en
  // campaigns/actions.ts la descarta de landing_email_steps si el
  // asunto/contenido quedaron vacíos). Sin este chequeo, un lead que
  // elegía esa opción quedaba guardado con ok:true pero sin ningún
  // landing_email_step al cual engancharse — no se agendaba ningún
  // email_sends y nadie se enteraba, ni el lead ni el admin.
  if (esEnvioPersonalizado && !steps?.some((step) => step.step_number === opcion)) {
    return NextResponse.json(
      { ok: false, error: 'Esta opción no está disponible en este momento.' },
      { status: 400 }
    );
  }

  // Bugfix (2026-08-24, ver migración 0015): el insert en `leads` y el
  // agendado/reprogramado en `email_sends` ahora son UNA sola
  // transacción de Postgres (registrar_lead), no escrituras HTTP
  // sueltas — si el agendado falla, la excepción deshace también el
  // insert del lead (o el delete+insert de reprogramación en la rama
  // de duplicado), así que nunca puede quedar un lead huérfano sin
  // nada agendado, ni una reprogramación a medio camino. Los pasos
  // activos se releen DE NUEVO adentro de esa transacción — el `steps`
  // de más arriba queda solo para el 400 de "opción no disponible",
  // una validación de UX previa, ya no para agendar nada.
  //
  // La comparación por email pasa a ser una igualdad exacta sobre
  // lower(email) dentro de la función — ya no hace falta escapar
  // '%'/'_' como con el ilike de antes, porque ahí nunca hay comodines.
  const { data: resultado, error: registroError } = await supabase.rpc('registrar_lead', {
    p_campaign_id: campana.id,
    p_email: email,
    p_first_name: nombre,
    p_last_name: apellido,
    p_phone: phone,
    p_selected_option: opcion ?? null,
    p_envio_personalizado: esEnvioPersonalizado,
  });

  if (registroError || !resultado) {
    console.error('Error en registrar_lead:', registroError);
    return NextResponse.json({ ok: false, error: 'No se pudo guardar el lead.' }, { status: 500 });
  }

  const { es_duplicado, lead_id } = resultado as { es_duplicado: boolean; lead_id: string };

  if (es_duplicado) {
    return NextResponse.json({ ok: true, duplicado: true });
  }

  return NextResponse.json({ ok: true, lead_id });
}
