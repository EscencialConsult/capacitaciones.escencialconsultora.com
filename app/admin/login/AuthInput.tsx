import type { LucideIcon } from 'lucide-react';

// Mismo patrón que AuthInput.jsx de COMRURAL: ícono opcional adentro del
// campo. Acá vive una sola vez en vez de repetirse en cada input del form.
export function AuthInput({
  icon: Icon,
  label,
  id,
  ...inputProps
}: {
  icon?: LucideIcon;
  label: string;
  id: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5 text-sm text-one-blanco/80" htmlFor={id}>
      {label}
      <div className="relative">
        {Icon && (
          <Icon
            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-one-blanco/40"
            strokeWidth={1.75}
          />
        )}
        <input
          id={id}
          {...inputProps}
          className={`w-full rounded-one-sm border border-one-blanco/15 bg-one-blanco/5 py-2.5 text-one-blanco outline-none transition-shadow focus-visible:border-one-fucsia focus-visible:ring-2 focus-visible:ring-one-fucsia/40 ${
            Icon ? 'pl-11 pr-4' : 'px-4'
          }`}
        />
      </div>
    </label>
  );
}
