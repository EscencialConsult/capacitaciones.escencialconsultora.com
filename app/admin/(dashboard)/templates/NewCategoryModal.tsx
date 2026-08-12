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
      className="rounded-full bg-one-fucsia px-6 py-2.5 text-sm font-bold text-one-negro transition-all duration-300 hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-60"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-one-oscuro/60 p-4">
      <div className="w-full max-w-sm rounded-one-lg bg-one-blanco p-6 shadow-sm">
        <h2 className="text-sm font-bold text-one-oscuro">Nueva categoría</h2>
        <form action={formAction} className="mt-4 space-y-3">
          <input
            name="name"
            autoFocus
            required
            placeholder="Ej: Productos"
            className="w-full rounded-one-sm border border-one-oscuro/15 bg-one-blanco px-3 py-2 text-sm text-one-oscuro outline-none focus:border-one-fucsia focus:ring-2 focus:ring-one-fucsia/20"
          />
          {state?.error && <p className="text-sm text-one-rojo">{state.error}</p>}
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-6 py-2.5 text-sm font-bold text-one-oscuro/70 transition-all duration-300 hover:bg-one-oscuro/5"
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
