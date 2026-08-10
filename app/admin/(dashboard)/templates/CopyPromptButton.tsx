'use client';

import { useState } from 'react';
import { armarPromptCampanaNueva } from '@/lib/landing-template-defaults';

export function CopyPromptButton() {
  const [copiado, setCopiado] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(armarPromptCampanaNueva());
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      }}
      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
    >
      {copiado ? '✓ Copiado' : 'Copiar prompt (diseño + datos de la campaña)'}
    </button>
  );
}
