import Link from 'next/link';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';
import { UserActions } from './UserActions';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const session = createSupabaseServerClient();
  const {
    data: { user: usuarioActual },
  } = await session.auth.getUser();

  const supabase = createSupabaseServiceClient();
  const {
    data: { users },
  } = await supabase.auth.admin.listUsers();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-extrabold text-one-oscuro">Usuarios del panel</h1>
        <Link
          href="/admin/users/new"
          prefetch={false}
          className="rounded-full bg-one-fucsia px-6 py-2.5 text-sm font-bold text-one-negro transition-all duration-300 hover:-translate-y-0.5"
        >
          + Nuevo usuario
        </Link>
      </div>

      <div className="mt-6 overflow-hidden rounded-one-lg bg-one-oscuro/5">
        <table className="w-full text-sm">
          <thead className="text-left text-one-oscuro/50">
            <tr>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Último acceso</th>
              <th className="px-4 py-3 font-semibold">Creado</th>
              <th className="px-4 py-3 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((u) => {
              const baneado = !!u.banned_until && new Date(u.banned_until) > new Date();
              return (
                <tr key={u.id} className="border-t border-one-oscuro/5">
                  <td className="px-4 py-3 font-semibold text-one-oscuro">{u.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        baneado ? 'bg-one-rojo/10 text-one-rojo' : 'bg-emerald-50 text-emerald-600'
                      }`}
                    >
                      {baneado ? 'deshabilitado' : 'activo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-one-oscuro/60">
                    {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString('es-AR') : 'nunca'}
                  </td>
                  <td className="px-4 py-3 text-one-oscuro/60">
                    {new Date(u.created_at).toLocaleDateString('es-AR')}
                  </td>
                  <td className="px-4 py-3">
                    <UserActions userId={u.id} baneado={baneado} esUsuarioActual={u.id === usuarioActual?.id} />
                  </td>
                </tr>
              );
            })}
            {(users ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-one-oscuro/40">
                  No hay usuarios.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
