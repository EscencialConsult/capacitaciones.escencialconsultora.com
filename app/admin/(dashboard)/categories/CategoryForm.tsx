'use client';

import { useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createCategory } from './actions';

function BotonCrear() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-azul px-4 py-2 text-sm font-semibold text-white hover:bg-azul-oscuro disabled:opacity-60"
    >
      {pending ? 'Creando...' : 'Crear categoría'}
    </button>
  );
}

export function CategoryForm() {
  const [state, formAction] = useFormState(createCategory, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex items-end gap-3">
      <div>
        <label className="block text-sm font-medium text-slate-700" htmlFor="name">
          Nombre de la categoría nueva
        </label>
        <input
          id="name"
          name="name"
          required
          placeholder="Ej: Productos"
          className="mt-1 w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-azul focus:outline-none"
        />
      </div>
      <BotonCrear />
      {state?.error && <p className="pb-2 text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
