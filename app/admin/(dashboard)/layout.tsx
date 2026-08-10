import Link from 'next/link';
import { signOut } from '../login/actions';

const NAV = [
  { href: '/admin', label: 'Inicio' },
  { href: '/admin/landings', label: 'Landings' },
  { href: '/admin/templates', label: 'Plantillas de landing' },
  { href: '/admin/email-templates', label: 'Plantillas de email' },
  { href: '/admin/categories', label: 'Categorías' },
  { href: '/admin/users', label: 'Usuarios' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/admin" prefetch={false} className="font-semibold text-slate-800">
              Escencial — Plataforma de Landings
            </Link>
            <form action={signOut}>
              <button type="submit" className="text-sm text-slate-600 hover:text-red-600">
                Salir
              </button>
            </form>
          </div>
          <nav className="mt-3 flex flex-wrap items-center gap-5 text-sm text-slate-600">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} prefetch={false} className="hover:text-azul">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
