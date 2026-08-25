'use client';

import { useState, useTransition } from 'react';
import { Play } from 'lucide-react';
import { activateCampaign } from './actions';
import { IconActionGlyph } from '../IconAction';

export function ActivateButton({
  campaignId,
  slug,
  label = 'Activar',
}: {
  campaignId: string;
  slug: string;
  /** "Activar" para una en borrador, "Reactivar" para una pausada — mismo botón, mismo action. */
  label?: string;
}) {
  const [, startTransition] = useTransition();
  // Booleano manual en vez de depender de `pending` de useTransition: `pending`
  // se apaga apenas el callback async cruza el primer await (comportamiento
  // documentado de React), mucho antes de que activateCampaign() termine en
  // el servidor. Acá el confirm() nativo bloquea el hilo antes de cada
  // intento (no permite un doble click inmediato), pero mientras la primera
  // petición sigue en vuelo un segundo click abre otro confirm() encima sin
  // avisar que ya hay una en curso — confuso aunque no corrompe datos.
  // `busy` sí cubre la duración real del pedido porque lo prendemos antes
  // del await y lo apagamos en el finally.
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        title={label}
        aria-label={label}
        disabled={busy}
        onClick={() => {
          setError(null);
          if (!confirm(`¿${label} esta campaña? A partir de ahora /${slug} va a mostrar su contenido de verdad.`)) {
            return;
          }
          setBusy(true);
          startTransition(async () => {
            try {
              const r = await activateCampaign(campaignId);
              if (r?.error) setError(r.error);
            } catch {
              // La Server Action rechazó (corte de red, timeout) en vez de devolver
              // {error} — no sabemos si el cambio llegó a impactar en el servidor.
              setError('No se pudo confirmar si se activó — recargá la página para chequear el estado real antes de reintentar.');
            } finally {
              setBusy(false);
            }
          });
        }}
        // Ícono en vez de texto (2026-08-25, pedido de Facundo) — se
        // mantiene el tinte fucsia (a diferencia de los demás IconAction,
        // neutros) porque activar es la acción más importante de una fila
        // en borrador/pausada, se merece más peso visual que un ícono
        // gris más — mismo criterio que ya tenía el botón de texto.
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-one-fucsia/30 bg-one-fucsia/5 text-one-fucsia transition-[transform,background-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:bg-one-fucsia/15 hover:shadow-one-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-one-fucsia/40 disabled:pointer-events-none disabled:opacity-60"
      >
        <IconActionGlyph icon={Play} busy={busy} />
      </button>
      {error && <span className="text-xs text-one-rojo">{error}</span>}
    </div>
  );
}
