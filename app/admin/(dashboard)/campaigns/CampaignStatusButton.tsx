'use client';

import { useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { iconActionClass } from '../IconAction';

/**
 * Botón genérico para las transiciones de estado de una campaña que no
 * son "activar" (que ya tiene su propio ActivateButton, con su mensaje
 * particular sobre /slug) ni "eliminar" (que tiene su propia pantalla
 * de confirmación, ver DeleteButton) — pausar y archivar comparten el
 * mismo patrón simple: un window.confirm() con el mensaje que le pases,
 * después llamar la server action ya bindeada al id de la campaña.
 *
 * Bug real confirmado (2026-08-25) — la versión anterior recibía el
 * ícono como prop (`icon: LucideIcon`), pasado desde campaigns/page.tsx
 * que es un Server Component. Next.js no deja pasar una función (un
 * componente React sin renderizar) de servidor a un Client Component —
 * solo JSX ya armado. Eso rompía la página con "Functions cannot be
 * passed directly to Client Components" apenas cargaba /admin/campaigns.
 * Fix: recibe `children` (el ícono YA renderizado por quien lo llama),
 * que sí es serializable — el propio componente decide cuándo mostrarlo
 * o cambiarlo por el spinner de "busy".
 */
export function CampaignStatusButton({
  label,
  children,
  confirmMessage,
  action,
}: {
  label: string;
  children: ReactNode;
  confirmMessage: string;
  action: () => Promise<{ error?: string } | void>;
}) {
  // Booleano manual en vez de `pending` de useTransition: ese `pending` se
  // apaga apenas el callback async cruza el primer await (comportamiento
  // documentado de React), mucho antes de que la Server Action termine en
  // el servidor. Eso reactivaba el botón casi al instante, permitiendo un
  // segundo click con su propio confirm() nativo mientras el primer
  // pedido todavía seguía en vuelo. `busy` sí cubre la duración real del
  // pedido porque lo prendemos antes de llamar action() y lo apagamos en
  // el finally.
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        title={label}
        aria-label={label}
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
        className={iconActionClass()}
      >
        {busy ? <Loader2 className="size-[18px] animate-spin" strokeWidth={1.75} /> : children}
      </button>
      {error && <span className="text-xs text-one-rojo">{error}</span>}
    </div>
  );
}
