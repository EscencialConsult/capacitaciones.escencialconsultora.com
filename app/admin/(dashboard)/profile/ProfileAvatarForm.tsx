'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { actualizarMiAvatar } from './actions';
import { AvatarPicker } from '../AvatarPicker';

function BotonGuardar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-one-fucsia px-6 py-2.5 text-sm font-bold text-one-negro transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-one-fucsia disabled:pointer-events-none disabled:opacity-60"
    >
      {pending ? 'Guardando...' : 'Guardar ícono'}
    </button>
  );
}

export function ProfileAvatarForm({ avatarActual }: { avatarActual?: string }) {
  const [state, formAction] = useFormState(actualizarMiAvatar, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <AvatarPicker name="avatar" defaultValue={avatarActual} />
      {state?.error && <p className="text-sm font-medium text-one-rojo">{state.error}</p>}
      {state?.ok && <p className="text-sm font-medium text-emerald-600">Guardado.</p>}
      <BotonGuardar />
    </form>
  );
}
