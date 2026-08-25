'use client';

import { useState, useTransition } from 'react';
import { UserCheck, UserX } from 'lucide-react';
import { toggleUserBan, deleteUser } from './actions';
import { DeleteButton } from '../DeleteButton';
import { iconActionClass, IconActionGlyph } from '../IconAction';

export function UserActions({
  userId,
  email,
  baneado,
  esUsuarioActual,
}: {
  userId: string;
  email: string;
  baneado: boolean;
  esUsuarioActual: boolean;
}) {
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = baneado ? 'Habilitar' : 'Deshabilitar';

  if (esUsuarioActual) {
    return <span className="text-xs text-one-oscuro/40">(vos)</span>;
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        title={label}
        aria-label={`${label} a ${email}`}
        disabled={busy}
        onClick={() => {
          setBusy(true);
          startTransition(async () => {
            setError(null);
            try {
              const r = await toggleUserBan(userId, !baneado);
              if (r?.error) setError(r.error);
            } finally {
              setBusy(false);
            }
          });
        }}
        className={iconActionClass(baneado ? 'exito' : 'peligro')}
      >
        <IconActionGlyph icon={baneado ? UserCheck : UserX} busy={busy} />
      </button>
      {/* Mismo botón de borrado en 2 pasos que landings/plantillas/campañas
          (ver comentario en DeleteButton.tsx) — eliminar una cuenta de admin
          es la acción menos reversible del panel, no puede quedar atrás de
          un confirm() nativo que se cierra sin querer. */}
      <DeleteButton itemLabel={`la cuenta de "${email}"`} onDelete={deleteUser.bind(null, userId)} />
      {error && <span className="text-xs text-one-rojo">{error}</span>}
    </div>
  );
}
