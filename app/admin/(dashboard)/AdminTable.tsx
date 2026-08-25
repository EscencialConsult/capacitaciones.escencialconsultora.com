import type { ReactNode } from 'react';

/**
 * Cáscara compartida por TODAS las tablas de listado del panel
 * (2026-08-25) — antes cada página repetía a mano el mismo wrapper +
 * <thead>, y esa duplicación fue justo cómo se coló un bug de layout
 * en 6 de 7 tablas pero no en la séptima (la de Inicio, editada aparte
 * y por eso más fácil de olvidar). Con esto el encabezado es UN solo
 * lugar: cada página solo pasa sus columnas (la última puede ir vacía
 * para "Acciones") y arma su propio <tbody> con el contenido que le
 * corresponda — eso sigue libre porque cada tabla muestra cosas muy
 * distintas (íconos, logos, badges, links), pero la estructura
 * (wrapper redondeado + scroll horizontal + encabezado) tiene una sola
 * fuente de verdad.
 *
 * Encabezado gris + borde inferior fucsia — probamos negro sólido
 * primero y quedó pesado, compitiendo con el único CTA fucsia de la
 * pantalla en vez de ser solo estructura (ver DESIGN.md → La Regla de
 * la Rareza Fucsia). Esto da color real sin ese problema: gris apenas
 * tintado de fondo, acento fucsia solo como línea.
 */
export function TableShell({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 overflow-hidden rounded-one-lg bg-one-blanco shadow-one-sm ring-1 ring-one-oscuro/5">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function TableHead({ columns }: { columns: string[] }) {
  return (
    <thead className="border-b-2 border-one-fucsia/50 bg-one-oscuro/[0.035] text-left text-xs font-semibold tracking-wide text-one-oscuro/70 uppercase">
      <tr>
        {columns.map((etiqueta, i) => (
          <th key={i} className="px-4 py-3">
            {etiqueta}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function TableEmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-one-oscuro/40">
        {children}
      </td>
    </tr>
  );
}
