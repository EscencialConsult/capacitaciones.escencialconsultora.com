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
    // Micro-label mayúscula con tracking (2026-09-01, ver skill anti-ia
    // — "muy simplón" era, entre otras cosas, un label de párrafo común
    // sin ninguna decisión tipográfica). Mismo tratamiento que el
    // badge "PANEL DE ADMINISTRACIÓN" del panel izquierdo: un solo
    // sistema de labels chicos en toda la pantalla, no dos estilos
    // sueltos.
    <label className="flex flex-col gap-2 text-xs font-bold tracking-wide text-one-blanco/50 uppercase" htmlFor={id}>
      {label}
      <div className="relative">
        {/* input ANTES que el ícono en el DOM (2026-09-01) — a propósito,
            para que peer-focus (que solo mira hermanos SIGUIENTES en CSS)
            pueda afectar al ícono; la posición visual la sigue resolviendo
            el absolute de más abajo, no el orden real. */}
        <input
          id={id}
          {...inputProps}
          className={`peer w-full rounded-one-sm border border-one-blanco/15 bg-one-blanco/[0.04] py-3 text-sm font-medium normal-case text-one-blanco outline-none transition-[background-color,border-color,box-shadow] duration-200 placeholder:text-one-blanco/25 hover:border-one-blanco/25 focus-visible:border-one-fucsia/60 focus-visible:bg-one-blanco/[0.07] focus-visible:ring-2 focus-visible:ring-one-fucsia/25 ${
            Icon ? 'pl-11 pr-4' : 'px-4'
          }`}
        />
        {Icon && (
          <Icon
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-one-blanco/35 transition-colors duration-200 peer-focus:text-one-fucsia"
            strokeWidth={1.75}
          />
        )}
      </div>
    </label>
  );
}
