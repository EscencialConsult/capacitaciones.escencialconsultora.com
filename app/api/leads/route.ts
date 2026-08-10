import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { leadInputSchema } from '@/lib/leads';

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
  const { landing_id, nombre, apellido, email, phone } = parsed.data;

  const supabase = createSupabaseServiceClient();

  const { data: landing, error: landingError } = await supabase
    .from('landings')
    .select('id, status')
    .eq('id', landing_id)
    .single();

  if (landingError || !landing) {
    return NextResponse.json({ ok: false, error: 'La landing no existe.' }, { status: 404 });
  }
  if (landing.status !== 'active') {
    return NextResponse.json({ ok: false, error: 'Esta landing no está activa.' }, { status: 409 });
  }

  const { data: lead, error: insertError } = await supabase
    .from('leads')
    .insert({
      landing_id,
      email,
      first_name: nombre,
      last_name: apellido,
      phone: phone || null,
    })
    .select('id, created_at')
    .single();

  if (insertError) {
    // Constraint unique(landing_id, lower(email)) -> ya estaba registrado.
    // Código 23505 = unique_violation en Postgres.
    if (insertError.code === '23505') {
      return NextResponse.json({ ok: true, duplicado: true });
    }
    console.error('Error insertando lead:', insertError);
    return NextResponse.json({ ok: false, error: 'No se pudo guardar el lead.' }, { status: 500 });
  }

  // Agenda los envíos según los pasos activos configurados para esta landing.
  // El cálculo se hace UNA sola vez acá, tomando como base el momento de
  // captura — igual que en el sistema viejo, el lead arrastra su propio
  // calendario para siempre sin importar qué cambie después en la landing.
  const { data: steps, error: stepsError } = await supabase
    .from('landing_email_steps')
    .select('id, offset_days')
    .eq('landing_id', landing_id)
    .eq('is_active', true);

  if (stepsError) {
    console.error('Error leyendo landing_email_steps:', stepsError);
  } else if (steps && steps.length > 0) {
    const capturedAt = new Date(lead.created_at as string);
    const sends = steps.map((step) => ({
      lead_id: lead.id,
      landing_email_step_id: step.id,
      scheduled_for: new Date(
        capturedAt.getTime() + step.offset_days * 24 * 60 * 60 * 1000
      ).toISOString(),
      status: 'pending' as const,
    }));

    const { error: sendsError } = await supabase.from('email_sends').insert(sends);
    if (sendsError) {
      console.error('Error creando email_sends:', sendsError);
    }
  }

  return NextResponse.json({ ok: true, lead_id: lead.id });
}
