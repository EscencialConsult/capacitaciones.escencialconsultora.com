'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/admin/ventas', label: 'Analítica', exact: true },
  { href: '/admin/ventas/revisar', label: 'Revisar y sincronizar', exact: false },
];

/**
 * Pestañas de la sección Ventas (2026-09-01, pedido explícito: "el
 * inicio de este panel es todo el analytics, y este debe tener otra
 * pestaña... que es ver las ventas así los sincronizo") — dos rutas
 * reales de Next.js, no estado de cliente sin URL propia, mismo
 * criterio que el resto del panel (cada pantalla es su propia ruta,
 * se puede volver a ella con el botón atrás o un link directo).
 */
export function VentasTabs() {
  const pathname = usePathname();

  return (
    <div className="mt-4 flex gap-1 border-b border-one-oscuro/10">
      {TABS.map((tab) => {
        const activo = tab.exact ? pathname === tab.href : pathname?.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-bold transition-colors duration-150 ${
              activo
                ? 'border-one-fucsia text-one-oscuro'
                : 'border-transparent text-one-oscuro/50 hover:text-one-oscuro'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
