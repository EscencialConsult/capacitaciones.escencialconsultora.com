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
  const avatar = headers().get('x-user-avatar') || null;

  return (
    // .admin-glow (ver globals.css) — dos manchas de color fixed detrás de
    // todo, opacidad muy baja; bg-one-dots es la grilla de puntos sutil del
    // mismo criterio que la textura de fondo de las landings públicas. Un
    // único elemento reutilizado por TODA la zona /admin, no por página —
    // primer load liviano (solo CSS, nada de JS ni imagen), consistente con
    // el resto del shell (sidebar/header ya viven acá, no por pantalla).
    <div className="admin-glow relative flex min-h-svh overflow-hidden bg-one-blanco">
      <div className="relative z-10 flex w-full">
        <DashboardSidebar avatar={avatar} email={email} />
        <div className="flex flex-1 flex-col overflow-y-auto">
          <DashboardHeader email={email} avatar={avatar} />
          <main className="relative mx-auto w-full max-w-6xl flex-1 bg-one-dots bg-one-dots-size bg-fixed px-6 py-8">
            <div className="relative">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
