'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ClipboardList, Rocket, LayoutTemplate, Mail, Users, Plug, Palette, ShieldCheck } from 'lucide-react';
import { Avatar } from './Avatar';

const CLAVE_COLAPSADO = 'landings_sidebar_colapsado';

type ItemNav = { href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };

const NAV: ItemNav[] = [
  { href: '/admin', label: 'Inicio', icon: LayoutDashboard, exact: true },
  { href: '/admin/campaigns', label: 'Campañas', icon: ClipboardList },
  { href: '/admin/landings', label: 'Landings', icon: Rocket },
  // Marcas antes de Plantillas (2026-08-28) — es el paso lógico previo:
  // elegís o creás la marca ANTES de armar una plantilla que la use.
  { href: '/admin/marcas', label: 'Marcas', icon: Palette },
  { href: '/admin/templates', label: 'Plantillas de landing', icon: LayoutTemplate },
  { href: '/admin/email-templates', label: 'Plantillas de email', icon: Mail },
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
}: {
  avatar: string | null;
  email: string | null;
  esSuperAdmin: boolean;
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
          <div className="relative flex h-16 w-full items-center justify-center rounded-one-sm bg-one-blanco">
            <Image
              src="/logos/logo-escencial.webp"
              alt="Escencial"
              width={140}
              height={36}
              aria-hidden={colapsado}
              className={`sidebar-logo-fade absolute h-9 w-auto max-w-[85%] object-contain ${
                colapsado ? 'opacity-0' : 'opacity-100'
              }`}
            />
            <Image
              src="/logos/one-logocolor.webp"
              alt="Escencial"
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
            return (
              <Link
                key={item.href}
                href={item.href}
                className={linkClass(!!activo)}
                title={colapsado ? item.label : undefined}
              >
                <Icon className="size-5 shrink-0" strokeWidth={1.75} />
                <span className={`sidebar-label ${colapsado ? 'is-oculto' : ''}`}>{item.label}</span>
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
