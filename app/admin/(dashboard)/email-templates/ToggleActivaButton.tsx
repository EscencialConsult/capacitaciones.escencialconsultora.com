'use client';

import { useState, useTransition } from 'react';
import { toggleEmailTemplateActive } from './actions';

export function ToggleActivaButton({ templateId, activa }: { templateId: string; activa: boolean }) {
  const [, startTransition] = useTransition();
  // Booleano manual en vez de depender de `pending` de useTransition: `pending`
  // se apaga apenas el callback async cruza el primer await (comportamiento
  // documentado de React), mucho antes de que toggleEmailTemplateActive()
  // termine en el servidor. Eso dejaba el botón habilitado de nuevo casi al
  // instante y no frenaba un doble click mientras la primera petición seguía
  // en vuelo (bug real confirmado). `busy` sí cubre la duración real del
  // pedido porque lo prendemos antes del await y lo apagamos en el finally.
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setError(null);
          // toggleEmailTemplateActive ahora devuelve {error?} desde que
          // se le agregó el chequeo de sesión (2026-08-24, Ronda 2, bug
          // real confirmado) — antes esta llamada asumía que no
          // devolvía nada, lo que rompía el tipo esperado por
          // startTransition y silenciaba cualquier "No autorizado.".
          setBusy(true);
          startTransition(async () => {
            try {
              const r = await toggleEmailTemplateActive(templateId, !activa);
              if (r?.error) setError(r.error);
            } finally {
              setBusy(false);
            }
          });
        }}
        className="text-sm font-medium text-one-oscuro/50 transition-colors duration-150 hover:text-one-oscuro disabled:pointer-events-none disabled:opacity-50"
      >
        {activa ? 'Desactivar' : 'Activar'}
      </button>
      {error && <span className="text-xs text-one-rojo">{error}</span>}
    </div>
  );
}
