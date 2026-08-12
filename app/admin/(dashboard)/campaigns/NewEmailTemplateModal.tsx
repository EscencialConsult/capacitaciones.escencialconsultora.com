'use client';

import { useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createEmailTemplateInline } from '../email-templates/actions';

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

// Acceso directo a crear un diseño de email sin salir del formulario de
// campaña — mismo patrón que NewCategoryModal (templates/). Arranca con
// el HTML simple de respaldo (ver HTML_EMAIL_BASE en
// lib/landing-template-defaults.ts) y se puede pulir después desde
// /admin/email-templates; acá solo hace falta el nombre para no
// bloquear a Facundo en medio de la carga de la campaña.
export function NewEmailTemplateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (plantilla: { id: string; name: string }) => void;
}) {
  const [state, formAction] = useFormState(createEmailTemplateInline, undefined);

  useEffect(() => {
    if (state?.ok && state.template) onCreated(state.template);
  }, [state, onCreated]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-one-oscuro/60 p-4">
      <div className="w-full max-w-sm rounded-one-lg bg-one-blanco p-6 shadow-sm">
        <h2 className="text-sm font-bold text-one-oscuro">Nuevo diseño de email</h2>
        <p className="mt-1 text-xs text-one-oscuro/40">
          Arranca con un email simple de respaldo — lo podés terminar de diseñar después desde
          Diseños de email.
        </p>
        <form action={formAction} className="mt-4 space-y-3">
          <input
            name="name"
            autoFocus
            required
            placeholder="Ej: Recordatorio 48hs"
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
