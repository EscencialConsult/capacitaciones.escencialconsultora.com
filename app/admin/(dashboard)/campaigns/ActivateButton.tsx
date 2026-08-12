'use client';

import { useState, useTransition } from 'react';
import { activateCampaign } from './actions';

export function ActivateButton({ landingId, slug }: { landingId: string; slug: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          if (!confirm(`¿Activar esta campaña? A partir de ahora /${slug} va a estar público de verdad.`)) {
            return;
          }
          startTransition(async () => {
            const r = await activateCampaign(landingId);
            if (r?.error) setError(r.error);
          });
        }}
        className="rounded-full bg-one-fucsia px-4 py-1.5 text-xs font-bold text-one-negro transition-all duration-300 hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-60"
      >
        {pending ? 'Activando...' : 'Activar'}
      </button>
      {error && <span className="text-xs text-one-rojo">{error}</span>}
    </div>
  );
}
