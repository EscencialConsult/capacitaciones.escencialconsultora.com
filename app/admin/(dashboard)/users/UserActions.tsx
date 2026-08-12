'use client';

import { useState, useTransition } from 'react';
import { toggleUserBan, deleteUser } from './actions';

export function UserActions({
  userId,
  baneado,
  esUsuarioActual,
}: {
  userId: string;
  baneado: boolean;
  esUsuarioActual: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (esUsuarioActual) {
    return <span className="text-xs text-one-oscuro/40">(vos)</span>;
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const r = await toggleUserBan(userId, !baneado);
            if (r?.error) setError(r.error);
          })
        }
        className="text-one-oscuro/50 hover:text-one-oscuro disabled:opacity-50"
      >
        {baneado ? 'Habilitar' : 'Deshabilitar'}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm('¿Eliminar esta cuenta? No se puede deshacer.')) return;
          startTransition(async () => {
            setError(null);
            const r = await deleteUser(userId);
            if (r?.error) setError(r.error);
          });
        }}
        className="text-one-rojo/70 hover:text-one-rojo disabled:opacity-50"
      >
        Eliminar
      </button>
      {error && <span className="text-xs text-one-rojo">{error}</span>}
    </div>
  );
}
