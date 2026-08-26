'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServiceClient, requireAdmin } from '@/lib/supabase/server';
import { encryptSecret, ultimos4 } from '@/lib/crypto';
import { formatoValido, validarApiKey } from '@/lib/integrations/validate';

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
    // Primera vez que ESTE admin conecta Resend — a diferencia de Brevo,
    // Resend exige un dominio propio verificado (no acepta un @gmail.com
    // como remitente), así que el email de remitente es igual de
    // obligatorio acá.
    if (!parsed.data.sender_email) {
      return {
        error:
          'Todavía no conectaste ninguna cuenta de Resend — además de la clave, completá el email de remitente (tiene que ser de un dominio que verificaste en Resend, no un @gmail.com).',
      };
    }

    const { error } = await supabase.from('resend_accounts').insert({
      user_id: admin.id,
      sender_email: parsed.data.sender_email,
      sender_name: parsed.data.sender_name || parsed.data.sender_email,
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
