'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function signIn(_prevState: { error?: string } | undefined, formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: 'Completá email y contraseña.' };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: 'Email o contraseña incorrectos.' };
  }

  redirect('/admin');
}

export async function signOut() {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  // /admin/login pisado directo (sin sesión) da 404 desde este momento
  // (ver middleware.ts) — mandar acá por la puerta secreta es lo único
  // que evita que cerrar sesión te deje viendo un 404 en la cara.
  redirect(`/${process.env.ADMIN_SECRET_PATH}/login`);
}
