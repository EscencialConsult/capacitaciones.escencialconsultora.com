'use client';

import { useState } from 'react';
import { armarPromptPlantillaNueva, type Marca, type MarcaPersonalizada } from '@/lib/landing-template-defaults';

export function CopyPromptButton({
  marca,
  marcaPersonalizada = null,
  envioPersonalizado,
}: {
  marca: Marca | null;
  // Marca creada desde /admin/marcas, ya resuelta (mismo criterio que
  // el resto del sistema: datos planos cruzando de Server a Client
  // Component, nunca funciones) — mutuamente excluyente con `marca`.
  marcaPersonalizada?: MarcaPersonalizada | null;
  envioPersonalizado: boolean;
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
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(
              armarPromptPlantillaNueva(marca, envioPersonalizado, marcaPersonalizada)
            );
            setErrorCopia(false);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
          } catch {
            setErrorCopia(true);
          }
        }}
        className="rounded-full border border-one-oscuro/15 px-6 py-2.5 text-sm font-bold text-one-oscuro transition-[transform,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:bg-one-oscuro/5"
      >
        {copiado ? '✓ Copiado' : 'Copiar prompt (solo diseño)'}
      </button>
      {errorCopia && (
        <span className="text-xs text-one-rojo">
          No se pudo copiar — probá de nuevo o copiá el texto a mano.
        </span>
      )}
    </div>
  );
}
