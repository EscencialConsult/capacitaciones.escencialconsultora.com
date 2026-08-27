'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';

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

/**
 * Alta de administrador desde la raíz del dominio (2026-08-27, pedido
 * explícito, SIN candado — Facundo eligió esto a propósito después de
 * que le expliqué el riesgo real: cualquiera que visite el dominio
 * puede crearse una cuenta con acceso completo al panel. No hay
 * invitación, aprobación ni límite de cuántas cuentas se pueden crear).
 * Mismo patrón que createUser (users/actions.ts) pero sin el chequeo de
 * `requireAdmin` — acá es exactamente lo que cambia.
 */
export async function registrarAdmin(_prevState: { error?: string } | undefined, formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const nombre = String(formData.get('nombre') ?? '').trim();
  const apellido = String(formData.get('apellido') ?? '').trim();

  if (!email || !password) return { error: 'Completá email y contraseña.' };
  if (password.length < 6) return { error: 'La contraseña tiene que tener al menos 6 caracteres.' };
  if (!nombre || !apellido) return { error: 'Completá nombre y apellido.' };
  if (nombre.length > 200 || apellido.length > 200) return { error: 'Nombre o apellido demasiado largo.' };

  const supabase = createSupabaseServiceClient();
  const { error: errorCreando } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre, apellido, celular: null, avatar: null },
  });

  if (errorCreando) {
    // Supabase devuelve un mensaje técnico en inglés para el caso más
    // común (email ya registrado) — uno propio en castellano es más
    // claro para quien está completando el form.
    if (errorCreando.message.toLowerCase().includes('already been registered')) {
      return { error: 'Ya existe una cuenta con ese email.' };
    }
    return { error: errorCreando.message };
  }

  // Cuenta creada — inicia sesión de una, sin pedirle que vuelva a
  // escribir las mismas credenciales en el formulario de login.
  const sesion = createSupabaseServerClient();
  const { error: errorLogin } = await sesion.auth.signInWithPassword({ email, password });
  if (errorLogin) {
    return { error: 'Cuenta creada, pero no se pudo iniciar sesión sola — entrá con tu email y contraseña.' };
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
