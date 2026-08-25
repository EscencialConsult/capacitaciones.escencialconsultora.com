'use client';

import { useState, useTransition } from 'react';
import { sendPendingNow } from './actions';

export function EnviarPendientesButton() {
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      {resultado && (
        <span className="rounded-one-sm bg-one-oscuro/5 px-2.5 py-1 text-xs font-medium text-one-oscuro/60">
          {resultado}
        </span>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setResultado(null);
          setBusy(true);
          startTransition(async () => {
            try {
              const r = await sendPendingNow();
              if ('error' in r) {
                setResultado(r.error ?? 'No se pudo procesar.');
                return;
              }
              setResultado(
                `${r.enviados} enviados, ${r.errores} con error${r.omitidos ? `, ${r.omitidos} omitidos (campaña/landing ya no activa)` : ''} (${r.procesados} revisados)`
              );
            } finally {
              setBusy(false);
            }
          });
        }}
        className="rounded-full border border-one-oscuro/15 px-6 py-2.5 text-sm font-bold text-one-oscuro transition-[transform,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:bg-one-oscuro/5 disabled:pointer-events-none disabled:opacity-60"
      >
        {busy ? 'Enviando...' : 'Enviar pendientes ahora'}
      </button>
    </div>
  );
}
