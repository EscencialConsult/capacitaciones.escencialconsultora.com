import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';
import { UserActions } from './UserActions';
import { CreateUserForm } from './CreateUserForm';
import { Avatar } from '../Avatar';
import { TableShell, TableHead, TableEmptyRow } from '../AdminTable';
import { formatFechaHoraAR, formatFechaAR } from '@/lib/fecha';

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

      <TableShell>
        <TableHead columns={['Nombre', 'Email', 'Celular', 'Estado', 'Último acceso', 'Creado', '']} />
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
                  {/* Bug real confirmado (2026-08-25) — sin truncar, un nombre
                      o email largo pasaba a 2 líneas y esa fila quedaba más
                      alta que el resto, descuadrando toda la tabla. */}
                  <td className="px-4 py-3 text-one-oscuro">
                    <div className="flex max-w-[200px] items-center gap-2">
                      <Avatar avatar={meta.avatar} email={u.email} size="sm" />
                      <span className="truncate" title={nombreCompleto || undefined}>
                        {nombreCompleto || '—'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-one-oscuro">
                    <span className="block max-w-[220px] truncate" title={u.email}>
                      {u.email}
                    </span>
                  </td>
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
                    {u.last_sign_in_at ? formatFechaHoraAR(u.last_sign_in_at) : 'nunca'}
                  </td>
                  <td className="px-4 py-3 text-one-oscuro/60">
                    {formatFechaAR(u.created_at)}
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
            {(users ?? []).length === 0 && <TableEmptyRow colSpan={7}>No hay usuarios.</TableEmptyRow>}
          </tbody>
      </TableShell>
    </div>
  );
}
