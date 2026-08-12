'use client';

import { useTransition } from 'react';
import { toggleLandingActive } from './actions';

export function LandingToggleActivaButton({ landingId, activa }: { landingId: string; activa: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => toggleLandingActive(landingId, !activa))}
      className="text-one-oscuro/50 hover:text-one-oscuro disabled:opacity-50"
    >
      {activa ? 'Desactivar' : 'Activar'}
    </button>
  );
}
