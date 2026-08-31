'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServiceClient, requireAdmin } from '@/lib/supabase/server';
import { encryptSecret, decryptSecret, ultimos4 } from '@/lib/crypto';
import { formatoValido, validarApiKey } from '@/lib/integrations/validate';
import { crearDominioResend, verificarDominioResend } from '@/lib/dominio-resend';
import { obtenerConfigGoogle, urlAutorizacionGoogle } from '@/lib/google-oauth';

type Resultado = { error?: string; ok?: true };

/**
 * Panel de Integraciones (2026-08-24, pedido de Facundo) — pensado para
 * que alguien SIN conocimientos técnicos pueda conectar Brevo/Resend
 * pegando la API key en un formulario, en vez de tener que cargar una
 * variable de entorno en Netlify a mano. Cada conexión pasa por 3 pasos
 * antes de guardarse: formato (prefijo esperado) → llamada real al
 * proveedor (¿la acepta?) → recién ahí se cifra y se guarda. Nunca se
 * guarda una key sin haber confirmado que funciona — mismo criterio
 * "REGLA ANTI-INVENCIÓN" que ya usa el resto del sistema para no
 * guardar datos sin confirmar, aplicado acá a credenciales en vez de
 * contenido de campaña.
 *
 * Por persona (2026-08-26, pedido explícito) — antes esto era una sola
 * fila global por proveedor, compartida por todo el panel. Ahora cada
 * cuenta de Brevo/Resend tiene su propio `user_id`: cada admin conecta
 * la suya, y el sistema de créditos (ver migración 0019) cobra según
 * de quién es la cuenta que efectivamente activó cada campaña.
 */

const conectarBrevoSchema = z.object({
  api_key: z.string().trim().min(1, 'Pegá tu API key de Brevo.'),
  sender_email: z.string().trim().email('Email de remitente inválido.').optional().or(z.literal('')),
  sender_name: z.string().trim().optional().default(''),
});

export async function conectarBrevo(_prevState: Resultado | undefined, formData: FormData): Promise<Resultado> {
  const admin = await requireAdmin();
  if (!admin) return { error: 'No autorizado.' };

  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = conectarBrevoSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' };

  const apiKey = parsed.data.api_key;

  if (!formatoValido('brevo', apiKey)) {
    return { error: 'El formato de la clave no es correcto (tiene que empezar con "xkeysib-"). Revisá las instrucciones de abajo.' };
  }

  const validacion = await validarApiKey('brevo', apiKey);
  if (!validacion.valida) return { error: validacion.motivo };

  const supabase = createSupabaseServiceClient();

  const { data: actual } = await supabase
    .from('brevo_accounts')
    .select('id')
    .eq('user_id', admin.id)
    .maybeSingle();

  const apiKeyEncriptada = encryptSecret(apiKey);
  const last4 = ultimos4(apiKey);

  if (actual) {
    const { error } = await supabase
      .from('brevo_accounts')
      .update({ api_key_encrypted: apiKeyEncriptada, api_key_last4: last4, validated_at: new Date().toISOString() })
      .eq('id', actual.id);

    if (error) {
      console.error('Error guardando la key de Brevo (cuenta existente):', error);
      return { error: 'La clave es válida pero no se pudo guardar. Probá de nuevo.' };
    }
  } else {
    // Primera vez que ESTE admin conecta Brevo — hace falta también el
    // remitente, columna not null sin default razonable posible.
    if (!parsed.data.sender_email) {
      return {
        error:
          'Todavía no conectaste ninguna cuenta de Brevo — además de la clave, completá el email y el nombre de remitente para crear la tuya.',
      };
    }

    const { error } = await supabase.from('brevo_accounts').insert({
      user_id: admin.id,
      name: `Brevo — ${admin.email}`,
      sender_email: parsed.data.sender_email,
      sender_name: parsed.data.sender_name || parsed.data.sender_email,
      api_key_encrypted: apiKeyEncriptada,
      api_key_last4: last4,
      validated_at: new Date().toISOString(),
      is_active: true,
      priority: 0,
    });

    if (error) {
      console.error('Error creando la cuenta de Brevo desde el panel:', error);
      return { error: 'La clave es válida pero no se pudo guardar. Probá de nuevo.' };
    }
  }

  revalidatePath('/admin/settings/integrations');
  return { ok: true };
}

export async function desconectarBrevo(): Promise<Resultado> {
  const admin = await requireAdmin();
  if (!admin) return { error: 'No autorizado.' };

  const supabase = createSupabaseServiceClient();

  const { data: actual } = await supabase
    .from('brevo_accounts')
    .select('id')
    .eq('user_id', admin.id)
    .maybeSingle();

  if (!actual) return { ok: true };

  // Solo se limpia la clave cifrada — nunca se borra la fila ni
  // env_var_name: si esta cuenta se creó originalmente con una variable
  // de entorno real (el flujo de siempre, antes de que existiera este
  // panel), desconectar desde acá vuelve a dejarla funcionando con esa
  // env var en vez de cortar el envío de emails de golpe.
  const { error } = await supabase
    .from('brevo_accounts')
    .update({ api_key_encrypted: null, api_key_last4: null, validated_at: null })
    .eq('id', actual.id);

  if (error) {
    console.error('Error desconectando Brevo:', error);
    return { error: 'No se pudo desconectar. Probá de nuevo.' };
  }

  revalidatePath('/admin/settings/integrations');
  return { ok: true };
}

const conectarResendSchema = z.object({
  api_key: z.string().trim().min(1, 'Pegá tu API key de Resend.'),
  sender_email: z.string().trim().email('Email de remitente inválido.').optional().or(z.literal('')),
  sender_name: z.string().trim().optional().default(''),
});

export async function conectarResend(_prevState: Resultado | undefined, formData: FormData): Promise<Resultado> {
  const admin = await requireAdmin();
  if (!admin) return { error: 'No autorizado.' };

  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = conectarResendSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' };

  const apiKey = parsed.data.api_key;

  if (!formatoValido('resend', apiKey)) {
    return { error: 'El formato de la clave no es correcto (tiene que empezar con "re_"). Revisá las instrucciones de abajo.' };
  }

  const validacion = await validarApiKey('resend', apiKey);
  if (!validacion.valida) return { error: validacion.motivo };

  const supabase = createSupabaseServiceClient();

  const { data: actual } = await supabase
    .from('resend_accounts')
    .select('id')
    .eq('user_id', admin.id)
    .maybeSingle();

  const apiKeyEncriptada = encryptSecret(apiKey);
  const last4 = ultimos4(apiKey);

  if (actual) {
    const { error } = await supabase
      .from('resend_accounts')
      .update({ api_key_encrypted: apiKeyEncriptada, api_key_last4: last4, validated_at: new Date().toISOString() })
      .eq('id', actual.id);

    if (error) {
      console.error('Error guardando la key de Resend (cuenta existente):', error);
      return { error: 'La clave es válida pero no se pudo guardar. Probá de nuevo.' };
    }
  } else {
    // Primera vez que ESTE admin conecta Resend — a diferencia de antes
    // (2026-08-24 a 2026-08-31), YA NO hace falta pedir el email de
    // remitente acá: el dominio propio se crea y verifica solo, desde
    // este mismo panel, después de conectar la clave (ver
    // ResendDominioPropio.tsx y crearDominioPropioResend más abajo). Si
    // igual pegaron un sender_email a mano (alguien que ya tiene un
    // dominio verificado de antes en Resend), se respeta tal cual.
    const { error } = await supabase.from('resend_accounts').insert({
      user_id: admin.id,
      sender_email: parsed.data.sender_email || null,
      sender_name: parsed.data.sender_name || parsed.data.sender_email || null,
      api_key_encrypted: apiKeyEncriptada,
      api_key_last4: last4,
      validated_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Error creando la cuenta de Resend desde el panel:', error);
      return { error: 'La clave es válida pero no se pudo guardar. Probá de nuevo.' };
    }
  }

  revalidatePath('/admin/settings/integrations');
  return { ok: true };
}

export async function desconectarResend(): Promise<Resultado> {
  const admin = await requireAdmin();
  if (!admin) return { error: 'No autorizado.' };

  const supabase = createSupabaseServiceClient();

  const { data: actual } = await supabase
    .from('resend_accounts')
    .select('id')
    .eq('user_id', admin.id)
    .maybeSingle();
  if (!actual) return { ok: true };

  const { error } = await supabase.from('resend_accounts').delete().eq('id', actual.id);

  if (error) {
    console.error('Error desconectando Resend:', error);
    return { error: 'No se pudo desconectar. Probá de nuevo.' };
  }

  revalidatePath('/admin/settings/integrations');
  return { ok: true };
}

// ── Dominio propio de Resend, verificado solo (2026-08-31) ──────────
// Reemplaza el paso manual de "andá a Hostinger y cargá estos DNS a
// mano" — ver lib/dominio-resend.ts para la orquestación real (Resend
// + Hostinger). Dos pasos separados porque la verificación de Resend es
// asíncrona (puede tardar unos minutos en confirmar el DNS): primero se
// crea el dominio y se cargan los registros, después se puede reintentar
// "Verificar ahora" las veces que haga falta hasta que Resend confirme.

const nombreSubdominioSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, 'Elegí un nombre de al menos 2 caracteres.')
  .max(40, 'Máximo 40 caracteres.')
  .regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones — sin espacios ni puntos.');

export async function crearDominioPropioResend(formData: FormData): Promise<Resultado> {
  const admin = await requireAdmin();
  if (!admin) return { error: 'No autorizado.' };

  const parsedNombre = nombreSubdominioSchema.safeParse(formData.get('subdominio'));
  if (!parsedNombre.success) return { error: parsedNombre.error.issues[0]?.message ?? 'Nombre inválido.' };

  const supabase = createSupabaseServiceClient();
  const { data: cuenta } = await supabase
    .from('resend_accounts')
    .select('id, api_key_encrypted')
    .eq('user_id', admin.id)
    .maybeSingle();

  if (!cuenta?.api_key_encrypted) {
    return { error: 'Conectá tu API key de Resend primero, arriba.' };
  }

  const apiKey = decryptSecret(cuenta.api_key_encrypted);
  const resultado = await crearDominioResend(apiKey, parsedNombre.data);

  if (!resultado.ok) {
    await supabase.from('resend_accounts').update({ dominio_estado: 'error', dominio_error: resultado.error }).eq('id', cuenta.id);
    return { error: resultado.error };
  }

  const { error } = await supabase
    .from('resend_accounts')
    .update({
      dominio_resend_id: resultado.dominioId,
      dominio_nombre: resultado.dominioNombre,
      dominio_estado: 'pendiente',
      dominio_error: null,
    })
    .eq('id', cuenta.id);

  if (error) {
    console.error('Error guardando el dominio de Resend creado:', error);
    return { error: 'El dominio se creó en Resend, pero no se pudo guardar acá. Probá de nuevo.' };
  }

  revalidatePath('/admin/settings/integrations');
  return { ok: true };
}

export async function verificarDominioPropioResend(): Promise<Resultado> {
  const admin = await requireAdmin();
  if (!admin) return { error: 'No autorizado.' };

  const supabase = createSupabaseServiceClient();
  const { data: cuenta } = await supabase
    .from('resend_accounts')
    .select('id, api_key_encrypted, dominio_resend_id, dominio_nombre')
    .eq('user_id', admin.id)
    .maybeSingle();

  if (!cuenta?.api_key_encrypted || !cuenta.dominio_resend_id) {
    return { error: 'Todavía no creaste ningún dominio para verificar.' };
  }

  const apiKey = decryptSecret(cuenta.api_key_encrypted);
  const resultado = await verificarDominioResend(apiKey, cuenta.dominio_resend_id);

  if (!resultado.ok) {
    await supabase.from('resend_accounts').update({ dominio_estado: 'error', dominio_error: resultado.error }).eq('id', cuenta.id);
    return { error: resultado.error };
  }

  if (resultado.status === 'verified') {
    // Verificado — se completa el remitente solo, sin que el admin
    // tenga que volver a escribir nada. noreply@ como local-part fijo:
    // es un dominio de envío técnico, no una casilla que alguien lea.
    const { error } = await supabase
      .from('resend_accounts')
      .update({
        dominio_estado: 'verificado',
        dominio_error: null,
        sender_email: `noreply@${cuenta.dominio_nombre}`,
        sender_name: admin.user_metadata?.nombre ? `${admin.user_metadata.nombre} — Escencial` : 'Escencial Consultora',
      })
      .eq('id', cuenta.id);

    if (error) {
      console.error('Error guardando la verificación del dominio de Resend:', error);
      return { error: 'Se verificó en Resend, pero no se pudo guardar acá. Probá de nuevo.' };
    }
  } else {
    await supabase
      .from('resend_accounts')
      .update({
        dominio_estado: 'pendiente',
        dominio_error: `Estado actual en Resend: "${resultado.status}" — el DNS puede tardar unos minutos en propagar. Volvé a intentar en un rato.`,
      })
      .eq('id', cuenta.id);
  }

  revalidatePath('/admin/settings/integrations');
  return { ok: true };
}

// ── Conectar Google (2026-08-31) — OAuth, nunca una API key pegada ──
// A diferencia de Brevo/Resend, acá no hay ningún formulario: el admin
// tira un click y Google se encarga del resto. Ver lib/google-oauth.ts
// para el intercambio de tokens (pasa por el route handler de
// settings/integrations/google/callback, no por acá).

export async function iniciarConexionGoogle() {
  const admin = await requireAdmin();
  if (!admin) redirect('/admin/login');

  const config = await obtenerConfigGoogle();
  if (!config) {
    // No debería poder pasar (el botón solo se muestra si ya está
    // configurado, ver GoogleIntegrationCard) — red de seguridad por si
    // alguien lo intenta con la pestaña vieja abierta.
    redirect('/admin/settings/integrations');
  }

  // CSRF: un valor random que viaja en la URL de Google y se vuelve a
  // comparar contra esta misma cookie cuando Google redirige de vuelta
  // (ver el route handler del callback) — sin esto, cualquiera podría
  // mandarle a un admin logueado un link de callback con un `code`
  // ajeno y conectar SU cuenta de Google a la de otra persona.
  const state = randomBytes(16).toString('hex');
  cookies().set('google_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 300,
    path: '/',
  });

  redirect(urlAutorizacionGoogle(config.clientId, state));
}

export async function desconectarGoogle(): Promise<Resultado> {
  const admin = await requireAdmin();
  if (!admin) return { error: 'No autorizado.' };

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from('google_accounts').delete().eq('user_id', admin.id);

  if (error) {
    console.error('Error desconectando Google:', error);
    return { error: 'No se pudo desconectar. Probá de nuevo.' };
  }

  revalidatePath('/admin/settings/integrations');
  return { ok: true };
}

export async function declararPlanGoogle(formData: FormData): Promise<Resultado> {
  const admin = await requireAdmin();
  if (!admin) return { error: 'No autorizado.' };

  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = planPagoSchema.safeParse(raw);
  if (!parsed.success) return { error: 'Datos inválidos.' };

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from('google_accounts')
    .update({
      plan_tipo: parsed.data.plan_tipo,
      creditos_pago: parsed.data.plan_tipo === 'pago' ? (parsed.data.creditos_pago ?? null) : null,
    })
    .eq('user_id', admin.id);

  if (error) {
    console.error('Error guardando el plan de Google:', error);
    return { error: 'No se pudo guardar. Probá de nuevo.' };
  }

  revalidatePath('/admin/settings/integrations');
  return { ok: true };
}

// ── Plan pago (2026-08-26, stub a propósito) ────────────────────────
// Sin pasarela de pago real todavía — Facundo pidió explícitamente
// dejar el botón/campo armado para "acordarme de implementarlo a
// futuro". Lo que SÍ es real: marcar una cuenta como plan pago y
// declarar cuántos créditos mensuales tiene cambia de verdad el
// cálculo de creditos_mensuales_de() (ver migración 0019) — no hace
// falta ningún código nuevo el día que haya un plan pago real, ya
// funciona con el número que se cargue acá.
const planPagoSchema = z.object({
  plan_tipo: z.enum(['free', 'pago']),
  creditos_pago: z.coerce.number().int().min(0).optional(),
});

export async function declararPlanBrevo(formData: FormData): Promise<Resultado> {
  const admin = await requireAdmin();
  if (!admin) return { error: 'No autorizado.' };

  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = planPagoSchema.safeParse(raw);
  if (!parsed.success) return { error: 'Datos inválidos.' };

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from('brevo_accounts')
    .update({
      plan_tipo: parsed.data.plan_tipo,
      creditos_pago: parsed.data.plan_tipo === 'pago' ? (parsed.data.creditos_pago ?? null) : null,
    })
    .eq('user_id', admin.id);

  if (error) {
    console.error('Error guardando el plan de Brevo:', error);
    return { error: 'No se pudo guardar. Probá de nuevo.' };
  }

  revalidatePath('/admin/settings/integrations');
  return { ok: true };
}

export async function declararPlanResend(formData: FormData): Promise<Resultado> {
  const admin = await requireAdmin();
  if (!admin) return { error: 'No autorizado.' };

  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = planPagoSchema.safeParse(raw);
  if (!parsed.success) return { error: 'Datos inválidos.' };

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from('resend_accounts')
    .update({
      plan_tipo: parsed.data.plan_tipo,
      creditos_pago: parsed.data.plan_tipo === 'pago' ? (parsed.data.creditos_pago ?? null) : null,
    })
    .eq('user_id', admin.id);

  if (error) {
    console.error('Error guardando el plan de Resend:', error);
    return { error: 'No se pudo guardar. Probá de nuevo.' };
  }

  revalidatePath('/admin/settings/integrations');
  return { ok: true };
}
