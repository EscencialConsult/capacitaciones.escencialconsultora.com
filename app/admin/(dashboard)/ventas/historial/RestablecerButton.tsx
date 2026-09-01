'use client';

import { useState, useTransition } from 'react';
import { RotateCcw, Loader2 } from 'lucide-react';
import { restablecerVenta } from './actions';

/**
 * Restablecer una fila del historial a pendiente (2026-09-01) — mismo
 * patrón que RetryEnvioButton: sin confirm() nativo, no es destructivo
 * (la venta vuelve a la cola de revisión, no se borra nada), solo pide
 * confirmar dos veces sería fricción de más para corregir un error.
 */
export function RestablecerButton({ ventaId }: { ventaId: string }) {
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [hecho, setHecho] = useState(false);
  const [error, setError] = useState('');

  if (hecho) {
    return <span className="text-xs font-semibold text-one-oscuro/40">Vuelta a pendiente</span>;
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setError('');
          startTransition(async () => {
            const r = await restablecerVenta(ventaId);
            if (r && 'error' in r) {
              setError(r.error ?? 'No se pudo restablecer.');
              setBusy(false);
              return;
            }
            setHecho(true);
          });
        }}
        title="Restablecer a pendiente — vuelve a la cola de revisión"
        className="inline-flex items-center gap-1 rounded-full border border-one-oscuro/15 px-2.5 py-1 text-xs font-semibold text-one-oscuro/60 transition-colors duration-150 hover:border-one-fucsia/40 hover:bg-one-fucsia/5 hover:text-one-oscuro disabled:pointer-events-none disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-3 animate-spin" /> : <RotateCcw className="size-3" strokeWidth={2.5} />}
        Restablecer
      </button>
      {error && <span className="text-xs text-one-rojo">{error}</span>}
    </span>
  );
}
