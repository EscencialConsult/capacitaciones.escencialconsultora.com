'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { signIn } from './actions';

function BotonEntrar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-azul px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-azul-oscuro disabled:opacity-60"
    >
      {pending ? 'Entrando...' : 'Entrar'}
    </button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useFormState(signIn, undefined);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <form
        action={formAction}
        className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg shadow-slate-200"
      >
        <h1 className="text-lg font-semibold text-slate-800">Panel de administración</h1>
        <p className="mt-1 text-sm text-slate-500">Escencial — Plataforma de Landings</p>

        <label className="mt-6 block text-sm font-medium text-slate-700" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-azul focus:outline-none"
        />

        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="password">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-azul focus:outline-none"
        />

        {state?.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}

        <div className="mt-6">
          <BotonEntrar />
        </div>
      </form>
    </main>
  );
}
