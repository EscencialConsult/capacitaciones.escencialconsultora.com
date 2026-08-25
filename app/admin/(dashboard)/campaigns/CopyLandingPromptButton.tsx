'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { armarPromptCampanaNueva } from '@/lib/landing-template-defaults';
import { obtenerVariablesSchemaFrescas } from './actions';

// El prompt cambia según qué plantilla esté elegida en el form (las
// variables a completar son distintas por plantilla) — por eso recibe
// `variables` como prop en vez de armar el texto por su cuenta.
export function CopyLandingPromptButton({
  landingId,
  variables,
  disabled,
}: {
  /**
   * Id de la landing elegida — bug real confirmado (2026-08-24, Ronda 2):
   * `variables` es un snapshot leído una sola vez al cargar la página (o
   * al crear una landing nueva), así que si la plantilla se edita en otra
   * pestaña mientras esta pantalla sigue abierta, copiar con ese snapshot
   * deja afuera cualquier variable nueva. Con `landingId` se refresca el
   * schema real desde el servidor justo antes de copiar (ver
   * obtenerVariablesSchemaFrescas en actions.ts); sin `landingId`, o si
   * ese refresco falla, se usa igual el snapshot en vez de dejar al admin
   * sin poder copiar nada.
   */
  landingId?: string;
  variables: { key: string; label: string; description?: string }[];
  /** true cuando todavía no se eligió una landing — evita copiar un prompt "de la nada" sin variables reales. */
  disabled?: boolean;
}) {
  const [copiado, setCopiado] = useState(false);
  // Feedback de error de portapapeles — bug real confirmado (2026-08-24,
  // Ronda 2): sin esto, si el navegador rechaza el acceso al portapapeles
  // (foco perdido, contexto no seguro, permiso denegado), el botón se
  // quedaba en silencio para siempre sin avisarle al admin que no copió.
  const [errorCopia, setErrorCopia] = useState(false);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={disabled}
        onClick={async () => {
          const variablesFrescas = landingId
            ? await obtenerVariablesSchemaFrescas(landingId).catch(() => null)
            : null;

          try {
            await navigator.clipboard.writeText(armarPromptCampanaNueva(variablesFrescas ?? variables));
            setErrorCopia(false);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
          } catch {
            setErrorCopia(true);
          }
        }}
        className="inline-flex items-center gap-2 rounded-full border border-one-oscuro/15 px-6 py-2.5 text-sm font-bold text-one-oscuro transition-[transform,background-color,border-color,color] duration-200 ease-out hover:-translate-y-0.5 hover:bg-one-oscuro/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-one-fucsia/40 disabled:pointer-events-none disabled:opacity-40"
      >
        {copiado ? (
          <Check className="size-4 text-emerald-600" strokeWidth={2.5} />
        ) : (
          <Copy className="size-4 text-one-oscuro/40" strokeWidth={1.75} />
        )}
        {copiado ? 'Copiado' : 'Copiar prompt (datos de la campaña)'}
      </button>
      {errorCopia && (
        <span className="text-xs text-one-rojo">
          No se pudo copiar — probá de nuevo o copiá el texto a mano.
        </span>
      )}
    </div>
  );
}
