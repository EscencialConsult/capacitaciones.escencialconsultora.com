'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, LogOut } from 'lucide-react';
import { LayoutDashboard, ClipboardList, Rocket, LayoutTemplate, Mail, Users } from 'lucide-react';
import { signOut } from '../login/actions';
import { Avatar } from './Avatar';

const ITEMS_BUSCABLES = [
  { id: 'inicio', nombre: 'Inicio', ruta: '/admin', icon: LayoutDashboard },
  { id: 'campaigns', nombre: 'Campañas', ruta: '/admin/campaigns', icon: ClipboardList },
  { id: 'landings', nombre: 'Landings', ruta: '/admin/landings', icon: Rocket },
  { id: 'templates', nombre: 'Plantillas de landing', ruta: '/admin/templates', icon: LayoutTemplate },
  { id: 'email-templates', nombre: 'Plantillas de email', ruta: '/admin/email-templates', icon: Mail },
  { id: 'users', nombre: 'Usuarios', ruta: '/admin/users', icon: Users },
];

function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

// Header clonado de DashboardHeader.jsx (COMRURAL) — buscador que filtra
// los mismos ítems del sidebar y navega, más el pill de usuario y logout.
// Sin clima/notificaciones: esas features no existen en esta plataforma.
export function DashboardHeader({ email, avatar }: { email: string | null; avatar: string | null }) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState('');
  const [enfocado, setEnfocado] = useState(false);
  const buscadorRef = useRef<HTMLDivElement>(null);

  const resultados = busqueda.trim()
    ? ITEMS_BUSCABLES.filter((item) => normalizar(item.nombre).includes(normalizar(busqueda)))
    : [];
  const abierto = enfocado && busqueda.trim().length > 0;

  // Cierra el panel al clickear afuera del buscador. Antes había un overlay
  // fixed inset-0 que, al no tener ningún ancestro con z-index propio, se
  // dibujaba por encima de TODO el documento (incluido el propio input y el
  // resto del header/sidebar) y se comía el primer click de cualquier cosa
  // que no fuera el panel de resultados.
  useEffect(() => {
    if (!abierto) return;

    function alClickearAfuera(e: MouseEvent) {
      if (buscadorRef.current && !buscadorRef.current.contains(e.target as Node)) {
        setEnfocado(false);
      }
    }

    document.addEventListener('mousedown', alClickearAfuera);
    return () => document.removeEventListener('mousedown', alClickearAfuera);
  }, [abierto]);

  const irAResultado = (ruta: string) => {
    router.push(ruta);
    setBusqueda('');
    setEnfocado(false);
  };

  return (
    <header className="flex items-center gap-4 border-b border-one-oscuro/10 bg-one-blanco px-6 py-4">
      <div ref={buscadorRef} className="relative mx-auto w-full max-w-md">
        <label htmlFor="admin-search" className="sr-only">
          Buscar en el panel
        </label>
        <div className="flex items-center gap-2 rounded-full bg-one-oscuro/5 px-4 py-2 text-sm text-one-oscuro/70 transition-colors duration-200 focus-within:bg-one-oscuro/10 focus-within:ring-2 focus-within:ring-one-fucsia/20">
          <Search className="size-4 shrink-0 text-one-oscuro/40" strokeWidth={1.75} />
          <input
            id="admin-search"
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onFocus={() => setEnfocado(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && resultados[0]) {
                e.preventDefault();
                irAResultado(resultados[0].ruta);
              } else if (e.key === 'Escape') {
                setEnfocado(false);
                e.currentTarget.blur();
              }
            }}
            placeholder="Buscar en el panel…"
            className="w-full bg-transparent placeholder:text-one-oscuro/40 focus:outline-none"
          />
        </div>

        {abierto && (
          <div className="search-panel absolute top-full left-0 z-50 mt-2 w-full rounded-one-md bg-one-blanco p-2 shadow-one-lg ring-1 ring-one-oscuro/10">
            {resultados.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-one-oscuro/40">
                Sin resultados para &quot;{busqueda}&quot;.
              </p>
            ) : (
              <ul className="flex flex-col">
                {resultados.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => irAResultado(item.ruta)}
                      className="flex w-full items-center gap-3 rounded-one-sm px-3 py-2 text-left text-sm text-one-oscuro/80 transition-colors duration-150 hover:bg-one-fucsia/5"
                    >
                      <item.icon className="size-4 text-one-oscuro/40" strokeWidth={1.75} />
                      {item.nombre}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <Link
        href="/admin/profile"
        title="Mi perfil"
        className="flex items-center gap-2 rounded-full pl-2 transition-colors duration-150 hover:bg-one-oscuro/5"
      >
        <Avatar avatar={avatar} email={email} />
        <div className="hidden text-left sm:block">
          <p className="text-sm leading-tight font-semibold text-one-oscuro">{email ?? 'Admin'}</p>
          <p className="text-xs leading-tight text-one-oscuro/50">Administrador</p>
        </div>
      </Link>

      <form action={signOut}>
        <button
          type="submit"
          title="Cerrar sesión"
          className="rounded-full p-2 text-one-oscuro/50 transition-colors duration-200 hover:bg-one-rojo/10 hover:text-one-rojo"
        >
          <LogOut className="size-5" strokeWidth={1.75} />
        </button>
      </form>
    </header>
  );
}
