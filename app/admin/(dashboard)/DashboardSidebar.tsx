'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ClipboardList, Rocket, LayoutTemplate, Mail, Users, Plug, Palette, ShieldCheck, DollarSign } from 'lucide-react';
import { Avatar } from './Avatar';

const CLAVE_COLAPSADO = 'landings_sidebar_colapsado';

type ItemNav = { href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean; paso?: number };

// paso 1-2-3 (2026-08-31, pedido explícito: "poné algo que muestre los
// pasos para una campaña") — el orden real para publicar algo nuevo:
// armar la plantilla, crear la landing con esa plantilla, crear la
// campaña que le da contenido y la activa. Un numerito discreto sobre
// el ícono, no reemplaza el nombre — sigue siendo "Plantillas de
// landing", solo con una pista de en qué orden usarlas la primera vez.
const NAV: ItemNav[] = [
  { href: '/admin', label: 'Inicio', icon: LayoutDashboard, exact: true },
  { href: '/admin/campaigns', label: 'Campañas', icon: ClipboardList, paso: 3 },
  // Ventas (2026-09-01, pedido explícito) — cola de revisión de ventas
  // sin confirmar, ver el badge más abajo (ventasPendientes). No lleva
  // paso: no es parte del flujo de armar una campaña nueva, es algo que
  // se revisa aparte, cuando corresponda.
  { href: '/admin/ventas', label: 'Ventas', icon: DollarSign },
  { href: '/admin/landings', label: 'Landings', icon: Rocket, paso: 2 },
  { href: '/admin/templates', label: 'Plantillas de landing', icon: LayoutTemplate, paso: 1 },
  { href: '/admin/email-templates', label: 'Plantillas de email', icon: Mail },
  // Marcas movida acá (2026-08-31, pedido explícito: "ponelo arriba de
  // usuarios y sin número") — se usa una sola vez por marca (se crea y
  // se olvida), no en cada campaña como los 3 pasos de arriba, así que
  // no necesita estar mezclada entre ellos ni llevar su propio número.
  { href: '/admin/marcas', label: 'Marcas', icon: Palette },
  { href: '/admin/users', label: 'Usuarios', icon: Users },
  { href: '/admin/settings/integrations', label: 'Integraciones', icon: Plug },
];

// Solo se agrega para quien es superadmin (ver esSuperAdmin en el
// layout) — config de toda la plataforma, no de un admin puntual (hoy:
// Client ID/Secret de Google OAuth). El resto de los admins ni lo ve.
const NAV_SUPERADMIN: ItemNav = { href: '/admin/superadmin', label: 'Superadmin', icon: ShieldCheck };

// Mecánica clonada 1:1 de DashboardSidebar.jsx (COMRURAL): estado persistido
// en localStorage, logo con fade cruzado (no swap de src), handle propio en
// el borde ADEMÁS del logo como toggle (redundante a propósito), timing
// compartido entre <aside>, label de texto e ítem de nav — ver globals.css.
export function DashboardSidebar({
  avatar,
  email,
  esSuperAdmin,
  ventasPendientes,
}: {
  avatar: string | null;
  email: string | null;
  esSuperAdmin: boolean;
  ventasPendientes: number;
}) {
  const pathname = usePathname();
  const [colapsado, setColapsado] = useState(false);
  const [montado, setMontado] = useState(false);
  const nav = esSuperAdmin ? [...NAV, NAV_SUPERADMIN] : NAV;

  // useLayoutEffect (no useEffect) para leer la preferencia guardada ANTES de
  // que el navegador pinte: evita el flash de sidebar expandido -> colapsado
  // en cada F5 o carga dura cuando el usuario ya lo tenía colapsado.
  useLayoutEffect(() => {
    setColapsado(localStorage.getItem(CLAVE_COLAPSADO) === 'true');
    setMontado(true);
  }, []);

  useEffect(() => {
    if (montado) localStorage.setItem(CLAVE_COLAPSADO, String(colapsado));
  }, [colapsado, montado]);

  const linkClass = (activo: boolean) =>
    `sidebar-navitem flex items-center rounded-one-sm py-2.5 text-sm font-medium ${
      colapsado ? 'is-colapsado' : ''
    } ${
      activo
        ? 'bg-one-fucsia/15 text-one-fucsia'
        : 'text-one-lavanda hover:bg-one-blanco/5 hover:text-one-blanco'
    }`;

  return (
    <div className="relative flex shrink-0">
      <aside
        className={`sidebar-collapse flex h-svh flex-col overflow-y-auto bg-one-oscuro py-6 ${
          colapsado ? 'w-20 px-2' : 'w-64 px-4'
        }`}
      >
        <button
          type="button"
          onClick={() => setColapsado((v) => !v)}
          title={colapsado ? 'Expandir menú' : 'Minimizar menú'}
          className={`mb-8 block ${colapsado ? '' : 'px-1'}`}
        >
          {/* Mismo logo de ONE en los dos estados (2026-08-31, pedido
              explícito) — antes expandido mostraba el wordmark de
              Escencial y colapsado el de ONE, dos marcas distintas
              según el estado. Ahora los dos son ONE: el isotipo solo
              (la espiral, sin texto) colapsado, y el logo completo
              (espiral + "NE") expandido — mismos archivos que ya usa
              el resto del sistema para esta marca, ver MARCAS en
              lib/landing-template-defaults.ts. */}
          <div className="relative flex h-16 w-full items-center justify-center rounded-one-sm bg-one-blanco">
            <Image
              src="/logos/one-logocolor.webp"
              alt="ONE"
              width={160}
              height={80}
              aria-hidden={colapsado}
              className={`sidebar-logo-fade absolute h-9 w-auto max-w-[85%] object-contain ${
                colapsado ? 'opacity-0' : 'opacity-100'
              }`}
            />
            <Image
              src="/logos/one/logo-isotipo.webp"
              alt="ONE"
              width={40}
              height={40}
              aria-hidden={!colapsado}
              className={`sidebar-logo-fade absolute size-9 object-contain ${
                colapsado ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </div>
        </button>

        <nav className="flex flex-1 flex-col gap-1">
          {nav.map((item) => {
            const activo = item.exact ? pathname === item.href : pathname?.startsWith(item.href);
            const Icon = item.icon;
            // Badge de pendientes (2026-09-01, "Ventas") — punto rojo
            // solo cuando el sidebar está colapsado (no hay lugar para
            // un número ahí), número real cuando está expandido.
            const conBadge = item.href === '/admin/ventas' && ventasPendientes > 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={linkClass(!!activo)}
                title={colapsado ? item.label : undefined}
              >
                <span className="relative inline-flex shrink-0">
                  <Icon className="size-5" strokeWidth={1.75} />
                  {item.paso && (
                    // Más grande + borde oscuro (2026-08-31, "se ve como
                    // que no se entiende") — un poco más grande y con
                    // borde propio para que no se pierda contra el
                    // ícono/fondo detrás, sea cual sea el color de
                    // ambos.
                    <span className="absolute -top-2 -left-2 flex size-4 items-center justify-center rounded-full border-2 border-one-oscuro bg-one-fucsia text-[10px] leading-none font-extrabold text-one-negro">
                      {item.paso}
                    </span>
                  )}
                  {conBadge && colapsado && (
                    <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-one-rojo" />
                  )}
                </span>
                <span className={`sidebar-label ${colapsado ? 'is-oculto' : ''}`}>{item.label}</span>
                {conBadge && !colapsado && (
                  <span className="ml-auto flex size-4 shrink-0 items-center justify-center rounded-full bg-one-rojo text-[10px] leading-none font-extrabold text-one-blanco">
                    {ventasPendientes > 99 ? '99+' : ventasPendientes}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/admin/profile"
          title={colapsado ? 'Mi perfil' : undefined}
          className={`sidebar-navitem mt-2 flex items-center gap-3 rounded-one-sm border-t border-one-blanco/10 py-3 text-one-lavanda hover:bg-one-blanco/5 hover:text-one-blanco ${
            colapsado ? 'is-colapsado justify-center' : ''
          }`}
        >
          <Avatar avatar={avatar} email={email} size="sm" />
          <span className={`sidebar-label truncate text-sm font-medium ${colapsado ? 'is-oculto' : ''}`}>
            {email ?? 'Mi perfil'}
          </span>
        </Link>
      </aside>

      <button
        type="button"
        onClick={() => setColapsado((v) => !v)}
        title={colapsado ? 'Expandir menú' : 'Minimizar menú'}
        className="absolute top-1/2 -right-1.5 z-10 h-10 w-3 -translate-y-1/2 rounded-full bg-one-blanco/15 transition-colors duration-200 hover:bg-one-fucsia/50"
      />
    </div>
  );
}
