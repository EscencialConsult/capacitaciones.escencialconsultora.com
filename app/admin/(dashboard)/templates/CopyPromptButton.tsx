'use client';

import { useState } from 'react';
import { armarPromptPlantillaNueva, type Marca } from '@/lib/landing-template-defaults';

export function CopyPromptButton({ marca }: { marca: Marca | null }) {
  const [copiado, setCopiado] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(armarPromptPlantillaNueva(marca));
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      }}
      className="rounded-full border border-one-oscuro/15 px-6 py-2.5 text-sm font-bold text-one-oscuro transition-all duration-300 hover:-translate-y-0.5 hover:bg-one-oscuro/5"
    >
      {copiado ? '✓ Copiado' : 'Copiar prompt (solo diseño)'}
    </button>
  );
}
