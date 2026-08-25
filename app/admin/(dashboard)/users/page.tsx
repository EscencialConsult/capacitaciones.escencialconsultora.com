import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';
import { UserActions } from './UserActions';
import { CreateUserForm } from './CreateUserForm';
import { Avatar } from '../Avatar';

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
      <h1 className="text-2xl font-extrabold tracking-tight text-one-oscuro">Usuarios del panel</h1>

      <CreateUserForm />

      <div className="mt-6 overflow-hidden rounded-one-lg bg-one-blanco shadow-one-sm ring-1 ring-one-oscuro/5">
        <table className="w-full text-sm">
          <thead className="text-left text-xs font-semibold tracking-wide text-one-oscuro/50 uppercase">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Celular</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Último acceso</th>
              <th className="px-4 py-3">Creado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((u) => {
              const baneado = !!u.banned_until && new Date(u.banned_until) > new Date();
              // user_metadata es JSON libre (sin tabla de perfiles propia
              // todavía) — puede venir vacío en usuarios creados antes de
              // este apartado (2026-08-24), por eso todo con fallback.
              const meta = (u.user_metadata ?? {}) as {
                nombre?: string;
                apellido?: string;
                celular?: string | null;
                avatar?: string | null;
              };
              const nombreCompleto = [meta.nombre, meta.apellido].filter(Boolean).join(' ');
              return (
                <tr key={u.id} className="table-row-hover border-t border-one-oscuro/5">
                  <td className="px-4 py-3 text-one-oscuro">
                    <div className="flex items-center gap-2">
                      <Avatar avatar={meta.avatar} email={u.email} size="sm" />
                      {nombreCompleto || '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-one-oscuro">{u.email}</td>
                  <td className="px-4 py-3 text-one-oscuro/60">{meta.celular || '—'}</td>
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
                    <UserActions
                      userId={u.id}
                      email={u.email ?? 'sin email'}
                      baneado={baneado}
                      esUsuarioActual={u.id === usuarioActual?.id}
                    />
                  </td>
                </tr>
              );
            })}
            {(users ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-one-oscuro/40">
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
