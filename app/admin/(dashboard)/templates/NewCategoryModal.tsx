'use client';

import { useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createCategory } from '../categories/actions';

function BotonCrear() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-azul px-4 py-2 text-sm font-semibold text-white hover:bg-azul-oscuro disabled:opacity-60"
    >
      {pending ? 'Creando...' : 'Crear'}
    </button>
  );
}

export function NewCategoryModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (categoria: { id: string; name: string }) => void;
}) {
  const [state, formAction] = useFormState(createCategory, undefined);

  useEffect(() => {
    if (state?.ok && state.category) onCreated(state.category);
  }, [state, onCreated]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-sm font-semibold text-slate-800">Nueva categoría</h2>
        <form action={formAction} className="mt-4 space-y-3">
          <input
            name="name"
            autoFocus
            required
            placeholder="Ej: Productos"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-azul focus:outline-none"
          />
          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <BotonCrear />
          </div>
        </form>
      </div>
    </div>
  );
}
