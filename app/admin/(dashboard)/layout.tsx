import { headers } from 'next/headers';
import { DashboardSidebar } from './DashboardSidebar';
import { DashboardHeader } from './DashboardHeader';

// Armazón único de sidebar + header para toda la zona autenticada (/admin
// y sus subpáginas) — mismo criterio que DashboardLayout.jsx de COMRURAL:
// se arma acá una sola vez, cada página solo pone su contenido adentro.
//
// El email viene del header x-user-email que ya setea middleware.ts — NO
// se vuelve a llamar auth.getUser() acá. Ese middleware ya valida la
// sesión en cada request bajo /admin/*; pedirlo de nuevo acá duplicaba el
// viaje de red a Supabase en cada navegación (esa fue la causa real de
// la lentitud entre pantallas, no el diseño).
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const email = headers().get('x-user-email');

  return (
    <div className="flex min-h-svh bg-one-blanco">
      <DashboardSidebar />
      <div className="flex flex-1 flex-col overflow-y-auto">
        <DashboardHeader email={email} />
        <main className="mx-auto w-full max-w-6xl px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
