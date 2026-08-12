'use client';

import { useTransition } from 'react';
import { toggleTemplateActive } from './actions';

export function ToggleActivaButton({ templateId, activa }: { templateId: string; activa: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => toggleTemplateActive(templateId, !activa))}
      className="text-one-oscuro/50 hover:text-one-oscuro disabled:opacity-50"
    >
      {activa ? 'Desactivar' : 'Activar'}
    </button>
  );
}
