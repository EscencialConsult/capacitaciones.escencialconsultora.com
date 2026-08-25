'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AVATARS } from '@/lib/avatars';

/**
 * "Mi perfil" (2026-08-24, pedido de Facundo) — a diferencia de
 * users/actions.ts (un admin editando a OTRO usuario, cliente service
 * role), esto es autoservicio: cada quien cambia su PROPIO avatar.
 * Por eso usa el cliente de SESIÓN (createSupabaseServerClient), no el
 * de service role — auth.updateUser() solo puede tocar la cuenta que
 * ya está logueada en esta request, no hace falta ningún chequeo de
 * "sos admin de quién" porque no hay ningún userId de por medio.
 */
export async function actualizarMiAvatar(_prevState: { error?: string } | undefined, formData: FormData) {
  const avatar = String(formData.get('avatar') ?? '').trim();

  // '' es válido (el usuario sacó su selección, vuelve a la inicial de
  // email) — lo que NO es válido es un archivo que no está en la lista
  // fija de public/profiles/, evita que alguien mande cualquier string
  // a mano y termine con un <img src> roto en todo el panel.
  if (avatar && !(AVATARS as readonly string[]).includes(avatar)) {
    return { error: 'Ese ícono no es válido.' };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ data: { avatar: avatar || null } });

  if (error) return { error: 'No se pudo guardar el ícono. Probá de nuevo.' };

  // Sin esto, el pill del header/sidebar (que lee el avatar del header
  // x-user-avatar seteado en middleware.ts) sigue mostrando el viejo
  // hasta la próxima navegación completa — revalidatePath fuerza a
  // releer el layout entero, que a su vez ya viene con el header
  // actualizado en la siguiente request.
  revalidatePath('/admin', 'layout');
  return { ok: true as const };
}
