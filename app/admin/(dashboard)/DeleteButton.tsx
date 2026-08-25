'use client';

import { useState } from 'react';
import { TriangleAlert, Trash2 } from 'lucide-react';
import { iconActionClass, IconActionGlyph } from './IconAction';

/**
 * Botonera de eliminar compartida por landings/plantillas/campañas/usuarios —
 * Facundo pidió explícitamente que un solo click no alcance para borrar
 * nada (2026-08-14): clickear "Eliminar" abre esta pantalla de
 * confirmación aparte, con un segundo botón explícito, en vez de un
 * window.confirm() nativo que se puede apretar sin querer. El borrado
 * real lo hace `onDelete` (la server action de cada entidad), que
 * además está protegida en la base: si hay datos reales conectados
 * (landings usando una plantilla, campañas usando una landing, leads o
 * emails enviados de una campaña), la foreign key lo rechaza y
 * `onDelete` devuelve ese error acá en vez de dejar borrar.
 *
 * Rediseño 2026-08-24 (DESIGN.md) — backdrop-blur acá SÍ es seguro (a
 * diferencia del login): no hay foto de fondo ni input de texto activo
 * detrás mientras el modal está abierto, así que no hay costo de
 * repintado real. shadow-one-lg (único lugar del sistema donde el
 * elemento necesita separarse de verdad del fondo, ver DESIGN.md →
 * Elevation) + transiciones explícitas en vez de transition-all.
 */
export function DeleteButton({
  itemLabel,
  onDelete,
}: {
  itemLabel: string;
  onDelete: () => Promise<{ error?: string } | void>;
}) {
  const [open, setOpen] = useState(false);
  // Booleano manual en vez de useTransition: `pending` de useTransition se
  // apaga apenas el callback async cruza el primer await (comportamiento
  // documentado de React), mucho antes de que el DELETE termine en el
  // servidor. Eso reactivaba "Cancelar" casi al instante y rompía la
  // protección de 2 pasos. `busy` sí cubre la duración real del pedido
  // porque lo prendemos antes de llamar onDelete() y lo apagamos en el
  // finally.
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        title="Eliminar"
        aria-label={`Eliminar ${itemLabel}`}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className={iconActionClass('peligro')}
      >
        <IconActionGlyph icon={Trash2} />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-one-oscuro/60 p-4 backdrop-blur-sm">
          <div className="stagger-in w-full max-w-sm rounded-one-lg bg-one-blanco p-6 shadow-one-lg">
            <div className="flex size-11 items-center justify-center rounded-full bg-one-rojo/10">
              <TriangleAlert className="size-5 text-one-rojo" strokeWidth={2} />
            </div>
            <h2 className="mt-4 text-base font-extrabold text-one-oscuro">¿Eliminar {itemLabel}?</h2>
            <p className="mt-1.5 text-sm text-one-oscuro/60">Esta acción no se puede deshacer.</p>
            {error && (
              <p className="mt-3 rounded-one-sm bg-one-rojo/10 px-3 py-2 text-xs font-medium text-one-rojo">
                {error}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => setOpen(false)}
                className="rounded-full px-5 py-2 text-sm font-bold text-one-oscuro/70 transition-colors duration-150 hover:bg-one-oscuro/5 disabled:pointer-events-none disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const r = await onDelete();
                    if (r?.error) {
                      setError(r.error);
                      return;
                    }
                    setOpen(false);
                  } finally {
                    setBusy(false);
                  }
                }}
                className="rounded-full bg-one-rojo px-5 py-2 text-sm font-bold text-one-blanco transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-one-md disabled:pointer-events-none disabled:opacity-60"
              >
                {busy ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
