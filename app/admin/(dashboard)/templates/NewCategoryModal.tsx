'use client';

import { useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createCategory } from '../categories/actions';
import { FormInput } from '../FormInput';

function BotonCrear() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-one-fucsia px-5 py-2 text-sm font-bold text-one-negro transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-one-md disabled:pointer-events-none disabled:opacity-60"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-one-oscuro/60 p-4 backdrop-blur-sm">
      <div className="stagger-in w-full max-w-sm rounded-one-lg bg-one-blanco p-6 shadow-one-lg">
        <h2 className="text-base font-extrabold text-one-oscuro">Nueva categoría</h2>
        <form action={formAction} className="mt-4 space-y-3">
          {/* Antes dependía solo del placeholder como label — react-doctor
              (no-placeholder-only-field) lo marcó porque un placeholder
              desaparece al tipear y no es un label real para lectores de
              pantalla. FormInput ya resuelve esto (label + htmlFor). El
              autoFocus se mantiene a propósito: es un modal de creación
              que se abre con un solo campo, así que enfocarlo apenas abre
              es UX intencional, no un pendiente de accesibilidad. */}
          <FormInput
            id="category-name"
            name="name"
            label="Nombre"
            autoFocus
            required
            placeholder="Ej: Productos"
          />
          {state?.error && <p className="text-sm text-one-rojo">{state.error}</p>}
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-5 py-2 text-sm font-bold text-one-oscuro/70 transition-colors duration-150 hover:bg-one-oscuro/5"
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
