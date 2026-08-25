'use client';

import { useState } from 'react';

/**
 * Botón genérico para las transiciones de estado de una campaña que no
 * son "activar" (que ya tiene su propio ActivateButton, con su mensaje
 * particular sobre /slug) ni "eliminar" (que tiene su propia pantalla
 * de confirmación, ver DeleteButton) — pausar y archivar comparten el
 * mismo patrón simple: un window.confirm() con el mensaje que le pases,
 * después llamar la server action ya bindeada al id de la campaña.
 */
export function CampaignStatusButton({
  label,
  pendingLabel,
  confirmMessage,
  action,
}: {
  label: string;
  pendingLabel: string;
  confirmMessage: string;
  action: () => Promise<{ error?: string } | void>;
}) {
  // Booleano manual en vez de `pending` de useTransition: ese `pending` se
  // apaga apenas el callback async cruza el primer await (comportamiento
  // documentado de React), mucho antes de que la Server Action termine en
  // el servidor. Eso reactivaba el botón y hacía desaparecer pendingLabel
  // casi al instante, permitiendo un segundo click con su propio confirm()
  // nativo mientras el primer pedido todavía seguía en vuelo. `busy` sí
  // cubre la duración real del pedido porque lo prendemos antes de llamar
  // action() y lo apagamos en el finally.
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setError(null);
          if (!confirm(confirmMessage)) return;
          setBusy(true);
          try {
            const r = await action();
            if (r?.error) setError(r.error);
          } catch {
            // La Server Action rechazó (corte de red, timeout) en vez de devolver
            // {error} — no sabemos si el cambio llegó a impactar en el servidor.
            setError('No se pudo confirmar si se aplicó el cambio — recargá la página para chequear el estado real antes de reintentar.');
          } finally {
            setBusy(false);
          }
        }}
        className="text-sm font-medium text-one-oscuro/50 transition-colors duration-150 hover:text-one-oscuro disabled:pointer-events-none disabled:opacity-50"
      >
        {busy ? pendingLabel : label}
      </button>
      {error && <span className="text-xs text-one-rojo">{error}</span>}
    </div>
  );
}
