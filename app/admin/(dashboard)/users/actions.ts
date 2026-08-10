'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';

/**
 * Todas estas acciones usan el cliente con service role — la API de
 * administración de usuarios (auth.admin.*) no es alcanzable con el
 * cliente de sesión normal, sin importar los permisos del usuario
 * logueado. Por eso esta carpeta entera vive protegida dentro de
 * (dashboard) — solo llega acá quien ya pasó el login.
 */

export async function createUser(_prevState: { error?: string } | undefined, formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) return { error: 'Completá email y contraseña.' };
  if (password.length < 6) return { error: 'La contraseña tiene que tener al menos 6 caracteres.' };

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });

  if (error) return { error: error.message };

  revalidatePath('/admin/users');
  redirect('/admin/users');
}

/** No te deja banearte a vos mismo — te dejaría afuera del panel sin forma de revertirlo desde acá. */
export async function toggleUserBan(userId: string, banear: boolean) {
  const session = createSupabaseServerClient();
  const {
    data: { user: usuarioActual },
  } = await session.auth.getUser();

  if (banear && usuarioActual?.id === userId) {
    return { error: 'No podés deshabilitar tu propia cuenta.' };
  }

  const supabase = createSupabaseServiceClient();
  await supabase.auth.admin.updateUserById(userId, {
    ban_duration: banear ? '876000h' : 'none', // ~100 años = deshabilitado hasta que se revierta
  });

  revalidatePath('/admin/users');
}

export async function deleteUser(userId: string) {
  const session = createSupabaseServerClient();
  const {
    data: { user: usuarioActual },
  } = await session.auth.getUser();

  if (usuarioActual?.id === userId) {
    return { error: 'No podés eliminar tu propia cuenta.' };
  }

  const supabase = createSupabaseServiceClient();
  await supabase.auth.admin.deleteUser(userId);

  revalidatePath('/admin/users');
}
