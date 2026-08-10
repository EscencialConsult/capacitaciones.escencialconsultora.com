'use server';

import { createSupabaseServiceClient } from '@/lib/supabase/server';

/**
 * Crea un usuario admin nuevo. Ojo: esta acción vive DENTRO del route
 * group protegido (dashboard) — solo es alcanzable si ya estás logueado
 * (el middleware.ts filtra todo /admin/* salvo /admin/login). No es una
 * ruta pública de auto-registro a propósito: exponer esto sin login
 * dejaría que cualquiera en internet se cree una cuenta con acceso total
 * a landings, leads y al envío de emails.
 */
export async function registerAdmin(_prevState: { error?: string; ok?: boolean } | undefined, formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: 'Completá email y contraseña.' };
  }
  if (password.length < 6) {
    return { error: 'La contraseña tiene que tener al menos 6 caracteres.' };
  }

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    return { error: error.message };
  }

  return { ok: true };
}
