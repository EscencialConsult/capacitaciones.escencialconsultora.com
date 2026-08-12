'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createUser } from '../actions';
import { FormInput } from '../../FormInput';

function BotonCrear() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-one-fucsia px-6 py-2.5 text-sm font-bold text-one-negro transition-all duration-300 hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-60"
    >
      {pending ? 'Creando...' : 'Crear usuario'}
    </button>
  );
}

export default function NewUserPage() {
  const [state, formAction] = useFormState(createUser, undefined);

  return (
    <div className="max-w-md">
      <h1 className="text-lg font-extrabold text-one-oscuro">Nuevo usuario del panel</h1>
      <p className="mt-1 text-sm text-one-oscuro/60">
        Va a poder loguearse en /admin/login con este email y contraseña, con el mismo acceso que vos.
      </p>

      <form action={formAction} className="mt-6 space-y-4 rounded-one-lg bg-one-oscuro/5 p-5">
        <FormInput id="email" name="email" label="Email" type="email" required />
        <FormInput id="password" name="password" label="Contraseña" type="password" minLength={6} required />

        {state?.error && <p className="text-sm text-one-rojo">{state.error}</p>}

        <BotonCrear />
      </form>
    </div>
  );
}
