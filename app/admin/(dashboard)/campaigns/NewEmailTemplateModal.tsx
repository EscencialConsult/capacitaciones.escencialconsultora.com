'use client';

import { useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createEmailTemplateInline } from '../email-templates/actions';
import { FormInput } from '../FormInput';

function BotonCrear() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-one-fucsia px-6 py-2.5 text-sm font-bold text-one-negro transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-one-fucsia disabled:pointer-events-none disabled:opacity-60"
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
//
// Rediseño 2026-08-24 (DESIGN.md) — chrome de modal igual al de
// DeleteButton.tsx/NewLandingModal.tsx (backdrop-blur, shadow-one-lg,
// stagger-in) para que los 3 modales del panel se sientan del mismo
// sistema. FormInput en vez de un <input> suelto: react-doctor marcaba
// que el campo dependía solo del placeholder para su label.
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-one-oscuro/60 p-4 backdrop-blur-sm">
      <div className="stagger-in w-full max-w-sm rounded-one-lg bg-one-blanco p-6 shadow-one-lg">
        <h2 className="text-lg font-extrabold text-one-oscuro">Nuevo diseño de email</h2>
        <p className="mt-1 text-xs text-one-oscuro/50">
          Arranca con un email simple de respaldo — lo podés terminar de diseñar después desde
          Diseños de email.
        </p>
        <form action={formAction} className="mt-4 space-y-3">
          <FormInput
            id="nuevo-diseno-email-nombre"
            name="name"
            label="Nombre del diseño"
            autoFocus
            required
            placeholder="Ej: Recordatorio 48hs"
          />
          {state?.error && <p className="text-sm text-one-rojo">{state.error}</p>}
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-6 py-2.5 text-sm font-bold text-one-oscuro/70 transition-colors duration-150 hover:bg-one-oscuro/5"
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
