'use client';

import { useState, useTransition } from 'react';
import { Play, CircleOff } from 'lucide-react';
import { toggleLandingActive } from './actions';
import { iconActionClass, IconActionGlyph } from '../IconAction';

export function LandingToggleActivaButton({
  landingId,
  activa,
  tieneCampanaActiva,
}: {
  landingId: string;
  activa: boolean;
  // Bug real confirmado (2026-08-24, Ronda 2) — este botón desactivaba
  // la landing con un solo click, sin ningún aviso, aunque tuviera una
  // campaña activa conectada (o sea, el link público /{slug} pasaba a
  // 404 al instante). Con este dato sabemos si corresponde el aviso más
  // fuerte antes de confirmar.
  tieneCampanaActiva: boolean;
}) {
  const [, startTransition] = useTransition();
  // Booleano manual en vez de depender de `pending` de useTransition: `pending`
  // se apaga apenas el callback async cruza el primer await (comportamiento
  // documentado de React), mucho antes de que toggleLandingActive() termine en
  // el servidor. `busy` sí cubre la duración real del pedido porque lo
  // prendemos antes del await y lo apagamos en el finally.
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
          if (activa) {
            const aviso = tieneCampanaActiva
              ? 'Esta landing tiene una campaña ACTIVA conectada — desactivarla apaga el link público de inmediato (queda 404 para cualquiera que lo abra). ¿Desactivar de todas formas?'
              : '¿Desactivar esta landing? El link público va a dejar de servir contenido.';
            if (!confirm(aviso)) return;
          }
          setBusy(true);
          startTransition(async () => {
            try {
              const r = await toggleLandingActive(landingId, !activa);
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
      {error && (
        <span className="rounded-one-sm bg-one-rojo/10 px-2 py-1 text-xs font-medium text-one-rojo">{error}</span>
      )}
    </div>
  );
}
