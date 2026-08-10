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
        <h1 className="text-lg font-semibold text-slate-800">Usuarios del panel</h1>
        <Link
          href="/admin/users/new"
          prefetch={false}
          className="rounded-lg bg-azul px-4 py-2 text-sm font-semibold text-white hover:bg-azul-oscuro"
        >
          + Nuevo usuario
        </Link>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Último acceso</th>
              <th className="px-4 py-3 font-medium">Creado</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((u) => {
              const baneado = !!u.banned_until && new Date(u.banned_until) > new Date();
              return (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-800">{u.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        baneado ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {baneado ? 'deshabilitado' : 'activo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString('es-AR') : 'nunca'}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
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
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
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
