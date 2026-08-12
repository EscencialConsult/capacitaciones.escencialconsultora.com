'use client';

import { useState } from 'react';
import { armarPromptCampanaNueva } from '@/lib/landing-template-defaults';

// El prompt cambia según qué plantilla esté elegida en el form (las
// variables a completar son distintas por plantilla) — por eso recibe
// `variables` como prop en vez de armar el texto por su cuenta.
export function CopyLandingPromptButton({ variables }: { variables: { key: string; label: string }[] }) {
  const [copiado, setCopiado] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(armarPromptCampanaNueva(variables));
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      }}
      className="rounded-full border border-one-oscuro/15 px-6 py-2.5 text-sm font-bold text-one-oscuro transition-all duration-300 hover:-translate-y-0.5 hover:bg-one-oscuro/5"
    >
      {copiado ? '✓ Copiado' : 'Copiar prompt (datos de la campaña)'}
    </button>
  );
}
