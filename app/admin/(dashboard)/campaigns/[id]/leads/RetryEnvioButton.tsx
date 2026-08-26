'use client';

import { useState, useTransition } from 'react';
import { RotateCw } from 'lucide-react';
import { reintentarEnvio } from '../../actions';

/**
 * Reintentar un envío puntual que falló (2026-08-26, pedido explícito
 * desde esta misma pantalla) — al lado de cada badge "✗ falló". No usa
 * confirm() nativo: reintentar un envío que falló no tiene ninguna
 * consecuencia destructiva (a diferencia de eliminar/desconectar), así
 * que pedir confirmación acá sería fricción sin ningún beneficio real.
 */
export function RetryEnvioButton({ envioId }: { envioId: string }) {
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        title="Reintentar este envío"
        aria-label="Reintentar este envío"
        disabled={busy}
        onClick={() => {
          setResultado(null);
          setBusy(true);
          startTransition(async () => {
            try {
              const r = await reintentarEnvio(envioId);
              if ('error' in r && r.error) {
                setResultado(r.error);
              } else if ('enviados' in r) {
                setResultado(r.enviados > 0 ? 'Enviado.' : r.errores > 0 ? 'Volvió a fallar.' : 'Sin cambios.');
              }
            } finally {
              setBusy(false);
            }
          });
        }}
        className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-one-rojo/70 transition-colors duration-150 hover:bg-one-rojo/10 hover:text-one-rojo disabled:pointer-events-none disabled:opacity-50"
      >
        <RotateCw className={`size-3 ${busy ? 'animate-spin' : ''}`} strokeWidth={2.5} />
      </button>
      {resultado && <span className="text-[10px] text-one-oscuro/50">{resultado}</span>}
    </span>
  );
}
