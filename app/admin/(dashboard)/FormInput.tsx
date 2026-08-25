import type { InputHTMLAttributes, ReactNode } from 'react';

// Estilos compartidos de campo de formulario para toda la zona /admin —
// mismo patrón claro que AuthInput.tsx (login) pero sobre fondo blanco en
// vez de oscuro. Se exportan las clases sueltas para que los <select> y
// <textarea> de cada form (que no pueden pasar por este componente) usen
// exactamente el mismo look sin repetir el string a mano — un solo cambio
// acá se propaga a TODA la zona /admin (ver DESIGN.md → Components → Inputs).
//
// Rediseño 2026-08-24 (DESIGN.md): transición explícita de borde/sombra en
// vez de depender del focus por default del navegador — mismo criterio de
// "nunca transition-all" del resto del sistema (react-doctor no-transition-all).
export const inputClass =
  'mt-1 w-full rounded-one-sm border border-one-oscuro/15 bg-one-blanco px-3 py-2 text-sm text-one-oscuro outline-none transition-[border-color,box-shadow] duration-200 ease-out placeholder:text-one-oscuro/35 focus:border-one-fucsia focus:ring-2 focus:ring-one-fucsia/20';
export const labelClass = 'block text-sm font-semibold text-one-oscuro/80';

export function FormInput({
  label,
  id,
  hint,
  ...inputProps
}: {
  label: string;
  id: string;
  hint?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className={labelClass} htmlFor={id}>
        {label}
      </label>
      <input id={id} {...inputProps} className={inputClass} />
      {hint && <p className="mt-1 text-xs text-one-oscuro/40">{hint}</p>}
    </div>
  );
}
