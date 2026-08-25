'use client';

import { useState, useTransition } from 'react';
import { toggleTemplateActive } from './actions';

export function ToggleActivaButton({ templateId, activa }: { templateId: string; activa: boolean }) {
  const [, startTransition] = useTransition();
  // toggleTemplateActive puede rechazar la desactivación (plantilla en
  // uso por alguna landing) y devolver {error} en vez de aplicar el
  // cambio — hay que mostrarlo, si no el click no hace nada y no se
  // entiende por qué. Ver comentario en templates/actions.ts.
  //
  // Booleano manual en vez de depender de `pending` de useTransition: `pending`
  // se apaga apenas el callback async cruza el primer await (comportamiento
  // documentado de React), mucho antes de que toggleTemplateActive() termine
  // en el servidor. Eso dejaba el botón habilitado de nuevo casi al instante
  // y no frenaba un doble click mientras la primera petición seguía en vuelo
  // (bug real confirmado). `busy` sí cubre la duración real del pedido
  // porque lo prendemos antes del await y lo apagamos en el finally.
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setError(null);
          setBusy(true);
          startTransition(async () => {
            try {
              const r = await toggleTemplateActive(templateId, !activa);
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
