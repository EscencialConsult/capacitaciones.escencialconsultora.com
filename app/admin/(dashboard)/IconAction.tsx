import type { LucideIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';

export type TonoAccion = 'neutro' | 'peligro' | 'exito';

const TONOS: Record<TonoAccion, string> = {
  neutro: 'text-one-oscuro/50 hover:bg-one-oscuro/5 hover:text-one-fucsia',
  peligro: 'text-one-oscuro/50 hover:bg-one-rojo/10 hover:text-one-rojo',
  exito: 'text-one-oscuro/50 hover:bg-emerald-50 hover:text-emerald-600',
};

/**
 * Botones/links de acción con ícono, sin texto visible (2026-08-25,
 * pedido de Facundo) — las filas de tabla del panel (Editar, Visualizar,
 * Activar, Pausar, Archivar, Eliminar...) tenían demasiado texto repetido
 * fila tras fila en las 47 pantallas del panel. El significado sigue
 * siendo accesible: `title` (tooltip nativo al pasar el mouse) +
 * `aria-label` (lector de pantalla) en cada uso — nunca un ícono solo sin
 * ninguno de los dos.
 *
 * `iconActionClass` (mismo patrón que inputClass/labelClass de
 * FormInput.tsx) para que un <Link> de navegación (Editar, Ver leads) y
 * un <button> de acción (Activar, Eliminar) se vean IDÉNTICOS sin
 * duplicar la definición de estilos en cada archivo — la única forma
 * real de lograr "concordancia entre todas las interfaces" en algo que
 * se repite en tantos lugares.
 */
export function iconActionClass(tono: TonoAccion = 'neutro'): string {
  return `inline-flex size-8 shrink-0 items-center justify-center rounded-one-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-one-fucsia/40 disabled:pointer-events-none disabled:opacity-50 ${TONOS[tono]}`;
}

/**
 * Ícono de la acción, o un spinner mientras está en curso — mismo tamaño
 * siempre (18px) para que el botón no cambie de tamaño al pasar a "busy".
 */
export function IconActionGlyph({ icon: Icon, busy }: { icon: LucideIcon; busy?: boolean }) {
  if (busy) return <Loader2 className="size-[18px] animate-spin" strokeWidth={1.75} />;
  return <Icon className="size-[18px]" strokeWidth={1.75} />;
}
