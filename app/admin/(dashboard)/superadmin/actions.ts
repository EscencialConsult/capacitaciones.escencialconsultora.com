'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServiceClient, requireAdmin } from '@/lib/supabase/server';
import { esSuperAdmin } from '@/lib/superadmin';
import { encryptSecret } from '@/lib/crypto';

type Resultado = { error?: string; ok?: true };

/**
 * Config de Google OAuth — SIEMPRE gateada por esSuperAdmin, no solo
 * requireAdmin (ver lib/superadmin.ts). Esto es infraestructura de toda
 * la plataforma, no un dato por-admin como una API key de Brevo/Resend.
 */
const configGoogleSchema = z.object({
  client_id: z.string().trim().min(1, 'Falta el Client ID.'),
  client_secret: z.string().trim().min(1, 'Falta el Client Secret.'),
});

export async function guardarConfigGoogle(_prevState: Resultado | undefined, formData: FormData): Promise<Resultado> {
  const admin = await requireAdmin();
  if (!admin || !esSuperAdmin(admin.email)) {
    return { error: 'No autorizado.' };
  }

  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = configGoogleSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' };

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from('google_oauth_config').upsert({
    id: 1,
    client_id: parsed.data.client_id,
    client_secret_encrypted: encryptSecret(parsed.data.client_secret),
    configurado_por: admin.id,
    configurado_en: new Date().toISOString(),
  });

  if (error) {
    console.error('Error guardando la config de Google OAuth:', error);
    return { error: 'No se pudo guardar. Probá de nuevo.' };
  }

  revalidatePath('/admin/superadmin');
  revalidatePath('/admin/settings/integrations');
  return { ok: true };
}

export async function borrarConfigGoogle(): Promise<Resultado> {
  const admin = await requireAdmin();
  if (!admin || !esSuperAdmin(admin.email)) {
    return { error: 'No autorizado.' };
  }

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from('google_oauth_config').delete().eq('id', 1);

  if (error) {
    console.error('Error borrando la config de Google OAuth:', error);
    return { error: 'No se pudo desconectar. Probá de nuevo.' };
  }

  revalidatePath('/admin/superadmin');
  revalidatePath('/admin/settings/integrations');
  return { ok: true };
}

/**
 * Aprobar/rechazar pedidos de conexión de Google (2026-08-31, pedido
 * explícito) — el paso real (agregar el email como Test user en Google
 * Cloud Console) NO se automatiza acá, no hay API de Google para eso —
 * esto solo registra la decisión DESPUÉS de que el superadmin ya hizo
 * ese paso a mano (ver el link directo a Test users en la UI, page.tsx).
 */
export async function aprobarConexionGoogle(userId: string): Promise<Resultado> {
  const admin = await requireAdmin();
  if (!admin || !esSuperAdmin(admin.email)) {
    return { error: 'No autorizado.' };
  }

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from('google_connection_requests')
    .update({ estado: 'aprobado', aprobado_por: admin.id, aprobado_en: new Date().toISOString() })
    .eq('user_id', userId);

  if (error) {
    console.error('Error aprobando conexión de Google:', error);
    return { error: 'No se pudo aprobar. Probá de nuevo.' };
  }

  revalidatePath('/admin/superadmin');
  revalidatePath('/admin/settings/integrations');
  return { ok: true };
}

export async function rechazarConexionGoogle(userId: string): Promise<Resultado> {
  const admin = await requireAdmin();
  if (!admin || !esSuperAdmin(admin.email)) {
    return { error: 'No autorizado.' };
  }

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from('google_connection_requests')
    .update({ estado: 'rechazado', aprobado_por: admin.id, aprobado_en: new Date().toISOString() })
    .eq('user_id', userId);

  if (error) {
    console.error('Error rechazando conexión de Google:', error);
    return { error: 'No se pudo rechazar. Probá de nuevo.' };
  }

  revalidatePath('/admin/superadmin');
  revalidatePath('/admin/settings/integrations');
  return { ok: true };
}
