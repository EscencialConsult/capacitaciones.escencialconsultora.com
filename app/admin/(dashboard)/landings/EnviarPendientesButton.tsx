'use client';

import { useState, useTransition } from 'react';
import { sendPendingNow } from './actions';

export function EnviarPendientesButton() {
  const [pending, startTransition] = useTransition();
  const [resultado, setResultado] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      {resultado && <span className="text-xs text-one-oscuro/50">{resultado}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setResultado(null);
          startTransition(async () => {
            const r = await sendPendingNow();
            setResultado(`${r.enviados} enviados, ${r.errores} con error (${r.procesados} revisados)`);
          });
        }}
        className="rounded-full border border-one-oscuro/15 px-6 py-2.5 text-sm font-bold text-one-oscuro transition-all duration-300 hover:-translate-y-0.5 hover:bg-one-oscuro/5 disabled:pointer-events-none disabled:opacity-60"
      >
        {pending ? 'Enviando...' : 'Enviar pendientes ahora'}
      </button>
    </div>
  );
}
