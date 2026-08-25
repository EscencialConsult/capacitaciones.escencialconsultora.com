'use client';

import { useState, useTransition } from 'react';
import { toggleUserBan, deleteUser } from './actions';
import { DeleteButton } from '../DeleteButton';

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

  if (esUsuarioActual) {
    return <span className="text-xs text-one-oscuro/40">(vos)</span>;
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
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
        className="text-sm font-medium text-one-oscuro/50 transition-colors duration-150 hover:text-one-oscuro disabled:opacity-50"
      >
        {baneado ? 'Habilitar' : 'Deshabilitar'}
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
