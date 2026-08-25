import { headers } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ProfileAvatarForm } from './ProfileAvatarForm';

export const dynamic = 'force-dynamic';

/**
 * "Mi perfil" — por ahora solo el ícono (2026-08-24, pedido de
 * Facundo: "se colocará o se actualizará desde el perfil del
 * usuario"). Nombre/apellido/celular se cargan hoy únicamente al crear
 * la cuenta desde /admin/users — editarlos desde acá es un paso
 * natural a futuro, pero no era lo pedido, así que no se agregó todavía
 * para no inventar alcance de más.
 */
export default async function ProfilePage() {
  const email = headers().get('x-user-email');
  const avatarActual = headers().get('x-user-avatar') || undefined;

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const meta = (user?.user_metadata ?? {}) as { nombre?: string; apellido?: string };
  const nombreCompleto = [meta.nombre, meta.apellido].filter(Boolean).join(' ');

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-extrabold tracking-tight text-one-oscuro">Mi perfil</h1>
      <p className="mt-1 text-sm text-one-oscuro/60">{nombreCompleto || email}</p>

      <div className="mt-6 rounded-one-lg bg-one-blanco p-6 shadow-one-sm ring-1 ring-one-oscuro/5">
        <ProfileAvatarForm avatarActual={avatarActual} />
      </div>
    </div>
  );
}
