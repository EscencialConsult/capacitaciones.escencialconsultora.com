'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';
import { AVATARS } from '@/lib/avatars';

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
  const nombre = String(formData.get('nombre') ?? '').trim();
  const apellido = String(formData.get('apellido') ?? '').trim();
  // Celular es el único campo opcional del apartado (2026-08-24, pedido
  // de Facundo) — mismo criterio que el teléfono del lead público en
  // HTML_BASE, no todos los admins lo tienen a mano al momento de cargar.
  const celular = String(formData.get('celular') ?? '').trim();
  // Ícono de perfil (2026-08-24) — opcional, elegido del set fijo de
  // public/profiles/ vía AvatarPicker. Se valida contra AVATARS (no
  // cualquier string a mano) por la misma razón que en profile/actions.ts:
  // evitar un <img src> roto en cualquier lugar donde se muestre.
  const avatar = String(formData.get('avatar') ?? '').trim();

  if (!email || !password) return { error: 'Completá email y contraseña.' };
  if (password.length < 6) return { error: 'La contraseña tiene que tener al menos 6 caracteres.' };
  if (!nombre || !apellido) return { error: 'Completá nombre y apellido.' };
  // Mismo tope que leadInputSchema (lib/leads.ts) para estos tres campos —
  // sin esto, un texto gigante pegado en el form queda tal cual en
  // auth.users.raw_user_meta_data (columna JSON) y rompe la celda de la
  // tabla de /admin/users.
  if (nombre.length > 200) return { error: 'Nombre demasiado largo.' };
  if (apellido.length > 200) return { error: 'Apellido demasiado largo.' };
  if (celular.length > 200) return { error: 'Celular demasiado largo.' };
  if (avatar && !(AVATARS as readonly string[]).includes(avatar)) return { error: 'Ese ícono no es válido.' };

  // Sin sesión válida, no se toca la API de administración (bypassea RLS por completo).
  const {
    data: { user: usuarioActual },
  } = await createSupabaseServerClient().auth.getUser();
  if (!usuarioActual) return { error: 'No autorizado.' };

  const supabase = createSupabaseServiceClient();
  // No hay tabla propia de perfiles todavía — nombre/apellido/celular se
  // guardan en user_metadata (columna JSON nativa de Supabase Auth), que
  // ya viaja gratis en cada fila de auth.admin.listUsers() sin necesidad
  // de un join ni una tabla nueva.
  const { error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre, apellido, celular: celular || null, avatar: avatar || null },
  });

  if (error) return { error: error.message };

  revalidatePath('/admin/users');
  redirect('/admin/users');
}

/**
 * Cuenta cuántos usuarios quedarían habilitados (no baneados) si se saca
 * al usuario `excluirId` de la cuenta. Se usa antes de banear/eliminar para
 * no dejar el panel sin nadie que pueda loguearse — no cierra el 100% de la
 * ventana de carrera entre dos requests simultáneas (para eso haría falta
 * un lock, como el de activar_campana), pero para 2-3 admins como mucho
 * alcanza con este chequeo por conteo.
 */
async function contarUsuariosHabilitadosSinExcluir(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  excluirId: string,
) {
  const {
    data: { users },
  } = await supabase.auth.admin.listUsers();

  const ahora = new Date();
  return (users ?? []).filter((u) => {
    if (u.id === excluirId) return false;
    const baneado = !!u.banned_until && new Date(u.banned_until) > ahora;
    return !baneado;
  }).length;
}

/** No te deja banearte a vos mismo — te dejaría afuera del panel sin forma de revertirlo desde acá. */
export async function toggleUserBan(userId: string, banear: boolean) {
  const session = createSupabaseServerClient();
  const {
    data: { user: usuarioActual },
  } = await session.auth.getUser();

  if (!usuarioActual) return { error: 'No autorizado.' };

  if (banear && usuarioActual.id === userId) {
    return { error: 'No podés deshabilitar tu propia cuenta.' };
  }

  const supabase = createSupabaseServiceClient();

  // Deshabilitar no puede dejar el panel sin ningún usuario que pueda entrar.
  if (banear) {
    const quedarian = await contarUsuariosHabilitadosSinExcluir(supabase, userId);
    if (quedarian === 0) {
      return { error: 'No se puede eliminar/deshabilitar: quedaría el panel sin ningún usuario que pueda ingresar.' };
    }
  }

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

  if (!usuarioActual) return { error: 'No autorizado.' };

  if (usuarioActual.id === userId) {
    return { error: 'No podés eliminar tu propia cuenta.' };
  }

  const supabase = createSupabaseServiceClient();

  // Eliminar no puede dejar el panel sin ningún usuario que pueda entrar.
  const quedarian = await contarUsuariosHabilitadosSinExcluir(supabase, userId);
  if (quedarian === 0) {
    return { error: 'No se puede eliminar/deshabilitar: quedaría el panel sin ningún usuario que pueda ingresar.' };
  }

  await supabase.auth.admin.deleteUser(userId);

  revalidatePath('/admin/users');
}
