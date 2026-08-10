'use client';

import { useTransition } from 'react';
import { toggleEmailTemplateActive } from './actions';

export function ToggleActivaButton({ templateId, activa }: { templateId: string; activa: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => toggleEmailTemplateActive(templateId, !activa))}
      className="text-slate-500 hover:text-slate-800 disabled:opacity-50"
    >
      {activa ? 'Desactivar' : 'Activar'}
    </button>
  );
}
