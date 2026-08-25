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
 */

const conectarBrevoSchema = z.object({
  api_key: z.string().trim().min(1, 'Pegá tu API key de Brevo.'),
  // Solo hacen falta la PRIMERA vez que se conecta Brevo desde el panel
  // (todavía no existe ninguna fila en brevo_accounts) — si ya hay una
  // cuenta activa (lo más probable, porque el sistema ya manda emails
  // hoy vía variable de entorno), estos campos se ignoran: actualizar
  // solo cambia la clave, nunca el remitente ya configurado.
  sender_email: z.string().trim().email('Email de remitente inválido.').optional().or(z.literal('')),
  sender_name: z.string().trim().optional().default(''),
});

export async function conectarBrevo(_prevState: Resultado | undefined, formData: FormData): Promise<Resultado> {
  if (!(await requireAdmin())) return { error: 'No autorizado.' };

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

  // La cuenta que hoy usa process-pending.ts para mandar emails de
  // verdad — mismo criterio de selección (activa, mayor prioridad) para
  // no crear una segunda cuenta "fantasma" que compita con la real.
  const { data: actual } = await supabase
    .from('brevo_accounts')
    .select('id')
    .eq('is_active', true)
    .order('priority', { ascending: true })
    .limit(1)
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
    // No hay ninguna cuenta de Brevo todavía — esta va a ser la primera,
    // así que además de la key hace falta saber desde qué dirección se
    // manda (columna not null, sin default razonable posible).
    if (!parsed.data.sender_email) {
      return {
        error:
          'Todavía no hay ninguna cuenta de Brevo conectada — además de la clave, completá el email y el nombre de remitente para crear la primera.',
      };
    }

    const { error } = await supabase.from('brevo_accounts').insert({
      name: 'Brevo (panel de integraciones)',
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
  if (!(await requireAdmin())) return { error: 'No autorizado.' };

  const supabase = createSupabaseServiceClient();

  const { data: actual } = await supabase
    .from('brevo_accounts')
    .select('id, env_var_name')
    .eq('is_active', true)
    .order('priority', { ascending: true })
    .limit(1)
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
});

export async function conectarResend(_prevState: Resultado | undefined, formData: FormData): Promise<Resultado> {
  if (!(await requireAdmin())) return { error: 'No autorizado.' };

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

  // Singleton en los hechos (el panel muestra una sola tarjeta de
  // Resend) — si ya había una fila, se reemplaza; si no, se crea.
  const { data: actual } = await supabase.from('resend_accounts').select('id').limit(1).maybeSingle();

  const apiKeyEncriptada = encryptSecret(apiKey);
  const last4 = ultimos4(apiKey);

  const { error } = actual
    ? await supabase
        .from('resend_accounts')
        .update({ api_key_encrypted: apiKeyEncriptada, api_key_last4: last4, validated_at: new Date().toISOString() })
        .eq('id', actual.id)
    : await supabase.from('resend_accounts').insert({
        api_key_encrypted: apiKeyEncriptada,
        api_key_last4: last4,
      });

  if (error) {
    console.error('Error guardando la key de Resend:', error);
    return { error: 'La clave es válida pero no se pudo guardar. Probá de nuevo.' };
  }

  revalidatePath('/admin/settings/integrations');
  return { ok: true };
}

export async function desconectarResend(): Promise<Resultado> {
  if (!(await requireAdmin())) return { error: 'No autorizado.' };

  const supabase = createSupabaseServiceClient();

  const { data: actual } = await supabase.from('resend_accounts').select('id').limit(1).maybeSingle();
  if (!actual) return { ok: true };

  // Acá sí se borra la fila entera (a diferencia de Brevo) — Resend no
  // tiene ningún otro dato propio (sender, límites) que valga la pena
  // conservar sin la key, es 100% la conexión y nada más.
  const { error } = await supabase.from('resend_accounts').delete().eq('id', actual.id);

  if (error) {
    console.error('Error desconectando Resend:', error);
    return { error: 'No se pudo desconectar. Probá de nuevo.' };
  }

  revalidatePath('/admin/settings/integrations');
  return { ok: true };
}
