'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createUser } from './actions';
import { FormInput } from '../FormInput';
import { AvatarPicker } from '../AvatarPicker';

function BotonCrear() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-one-fucsia px-6 py-2.5 text-sm font-bold text-one-negro transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-one-fucsia disabled:pointer-events-none disabled:opacity-60"
    >
      {pending ? 'Creando...' : 'Crear usuario'}
    </button>
  );
}

/**
 * Apartado de creación de usuarios (2026-08-24, pedido de Facundo) — al
 * inicio de /admin/users, siempre visible, en vez del flujo anterior de
 * un botón "+ Nuevo usuario" que llevaba a /admin/users/new. Campos:
 * email, contraseña, nombre, apellido y celular (el único opcional).
 * El form se resetea solo al crear con éxito porque createUser hace
 * redirect('/admin/users') — como ya estamos en esa misma ruta, Next.js
 * vuelve a renderizar la página con estado de formulario limpio.
 */
export function CreateUserForm() {
  const [state, formAction] = useFormState(createUser, undefined);

  return (
    <section className="mt-6 rounded-one-lg bg-one-blanco p-6 shadow-one-sm ring-1 ring-one-oscuro/5">
      <h2 className="text-lg font-extrabold text-one-oscuro">Crear usuario</h2>
      <p className="mt-1 text-sm text-one-oscuro/60">
        Va a poder loguearse en /admin/login con este email y contraseña, con el mismo acceso que vos.
      </p>

      <form action={formAction} className="mt-5 grid gap-4 sm:grid-cols-2">
        <FormInput id="nombre" name="nombre" label="Nombre" maxLength={200} required />
        <FormInput id="apellido" name="apellido" label="Apellido" maxLength={200} required />
        <FormInput id="email" name="email" label="Email" type="email" required />
        <FormInput id="password" name="password" label="Contraseña" type="password" minLength={6} required />
        <FormInput
          id="celular"
          name="celular"
          label="Celular (opcional)"
          type="tel"
          placeholder="+54 9 11 ..."
          maxLength={200}
        />

        <div className="sm:col-span-2">
          <AvatarPicker name="avatar" />
        </div>

        <div className="sm:col-span-2">
          {state?.error && <p className="mb-3 text-sm text-one-rojo">{state.error}</p>}
          <BotonCrear />
        </div>
      </form>
    </section>
  );
}
