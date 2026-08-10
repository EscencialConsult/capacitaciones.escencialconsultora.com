'use client';

import { useState, useTransition } from 'react';
import { sendPendingNow } from './actions';

export function EnviarPendientesButton() {
  const [pending, startTransition] = useTransition();
  const [resultado, setResultado] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      {resultado && <span className="text-xs text-slate-500">{resultado}</span>}
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
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        {pending ? 'Enviando...' : 'Enviar pendientes ahora'}
      </button>
    </div>
  );
}
