'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { registerAdmin } from './actions';

function BotonCrear() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-azul px-4 py-2 text-sm font-semibold text-white hover:bg-azul-oscuro disabled:opacity-60"
    >
      {pending ? 'Creando...' : 'Crear cuenta'}
    </button>
  );
}

export default function RegisterAdminPage() {
  const [state, formAction] = useFormState(registerAdmin, undefined);

  return (
    <div className="max-w-md">
      <h1 className="text-lg font-semibold text-slate-800">Crear cuenta de administrador</h1>
      <p className="mt-1 text-sm text-slate-500">
        Solo vos podés ver esta página (ya estás logueado). Sirve para sumar otra persona al panel
        más adelante — no es un registro público.
      </p>

      <form action={formAction} className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-azul focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="password">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            minLength={6}
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-azul focus:outline-none"
          />
        </div>

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state?.ok && <p className="text-sm text-green-700">Cuenta creada. Ya puede loguearse en /admin/login.</p>}

        <BotonCrear />
      </form>
    </div>
  );
}
