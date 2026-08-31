'use client';

import { useState, useTransition } from 'react';
import { DollarSign, Check } from 'lucide-react';
import { marcarLeadVendido } from '../../actions';

/**
 * Marcar un lead vendido a mano, uno por uno (2026-08-31, pedido
 * explícito: "así no se le siga enviando los emails de las campañas")
 * — mismo patrón que RetryEnvioButton (botón chico inline, sin
 * confirm() nativo: acá tampoco hay nada destructivo, solo cancela
 * emails que todavía no se mandaron).
 */
export function MarcarVendidoButton({ leadId, vendidoAt }: { leadId: string; vendidoAt: string | null }) {
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [marcadoLocal, setMarcadoLocal] = useState(false);

  if (vendidoAt || marcadoLocal) {
    return (
      <span
        title={vendidoAt ? new Date(vendidoAt).toLocaleString('es-AR') : undefined}
        className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600"
      >
        <Check className="size-3" strokeWidth={3} />
        Vendido
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      title="Marcar como vendido — cancela los emails de esta campaña que todavía no se le mandaron"
      onClick={() => {
        setBusy(true);
        startTransition(async () => {
          try {
            const r = await marcarLeadVendido(leadId);
            if (r && 'ok' in r && r.ok) setMarcadoLocal(true);
          } finally {
            setBusy(false);
          }
        });
      }}
      className="inline-flex items-center gap-1 rounded-full border border-one-oscuro/15 px-2 py-0.5 text-xs font-semibold text-one-oscuro/60 transition-colors duration-150 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600 disabled:pointer-events-none disabled:opacity-50"
    >
      <DollarSign className="size-3" strokeWidth={2.5} />
      {busy ? 'Marcando...' : 'Marcar vendido'}
    </button>
  );
}
