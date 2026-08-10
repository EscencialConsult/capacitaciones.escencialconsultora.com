'use client';

import { useState } from 'react';
import { armarPromptLandingNueva } from '@/lib/landing-instance-prompt';

export function CopyLandingPromptButton() {
  const [copiado, setCopiado] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(armarPromptLandingNueva());
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      }}
      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
    >
      {copiado ? '✓ Copiado' : 'Copiar prompt para armar esta landing con una IA'}
    </button>
  );
}
