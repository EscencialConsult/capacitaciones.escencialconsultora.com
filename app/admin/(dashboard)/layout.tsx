import Link from 'next/link';
import { signOut } from '../login/actions';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/admin" className="font-semibold text-slate-800">
            Escencial — Plataforma de Landings
          </Link>
          <nav className="flex items-center gap-5 text-sm text-slate-600">
            <Link href="/admin/landings" className="hover:text-azul">
              Landings
            </Link>
            <form action={signOut}>
              <button type="submit" className="hover:text-red-600">
                Salir
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
