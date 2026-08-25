'use client';

import { useState, useTransition } from 'react';
import { Play, CircleOff } from 'lucide-react';
import { toggleEmailTemplateActive } from './actions';
import { iconActionClass, IconActionGlyph } from '../IconAction';

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
  const label = activa ? 'Desactivar' : 'Activar';

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        title={label}
        aria-label={label}
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
        className={iconActionClass(activa ? 'peligro' : 'neutro')}
      >
        <IconActionGlyph icon={activa ? CircleOff : Play} busy={busy} />
      </button>
      {error && <span className="text-xs text-one-rojo">{error}</span>}
    </div>
  );
}
