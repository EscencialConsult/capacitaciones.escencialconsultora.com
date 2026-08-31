import { headers } from 'next/headers';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { esSuperAdmin } from '@/lib/superadmin';
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
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const email = headers().get('x-user-email');
  const avatar = headers().get('x-user-avatar') || null;
  const userId = headers().get('x-user-id') || null;

  // Contador de créditos del header (2026-08-28, pedido explícito: "que
  // esté a la par del user, arriba a la derecha") — antes solo vivía en
  // /admin/profile, así que había que navegar ahí para ver si quedaba
  // crédito. Dos RPCs livianas (ya existían, ver migración 0019), en
  // paralelo con el resto del layout — no bloquean el render del resto
  // del panel más de lo que ya tardaba.
  let creditosTotal = 0;
  let creditosUsados = 0;
  if (userId) {
    const admin = createSupabaseServiceClient();
    const [{ data: total }, { data: usados }] = await Promise.all([
      admin.rpc('creditos_mensuales_de', { p_user_id: userId }),
      admin.rpc('creditos_usados_ciclo_actual', { p_user_id: userId }),
    ]);
    creditosTotal = total ?? 0;
    creditosUsados = usados ?? 0;
  }

  return (
    // .admin-glow (ver globals.css) — dos manchas de color fixed detrás de
    // todo, opacidad muy baja; bg-one-dots es la grilla de puntos sutil del
    // mismo criterio que la textura de fondo de las landings públicas. Un
    // único elemento reutilizado por TODA la zona /admin, no por página —
    // primer load liviano (solo CSS, nada de JS ni imagen), consistente con
    // el resto del shell (sidebar/header ya viven acá, no por pantalla).
    <div className="admin-glow relative flex min-h-svh overflow-hidden bg-one-blanco">
      <div className="relative z-10 flex w-full">
        <DashboardSidebar avatar={avatar} email={email} esSuperAdmin={esSuperAdmin(email)} />
        <div className="flex flex-1 flex-col overflow-y-auto">
          <DashboardHeader email={email} avatar={avatar} creditosTotal={creditosTotal} creditosUsados={creditosUsados} />
          {/* Sin max-w (2026-08-25, pedido explícito) — con el tope
              anterior (max-w-6xl, 1152px) sobraba muchísimo espacio
              vacío a los costados en cualquier pantalla ancha real;
              ahora el contenido usa el ancho disponible completo,
              limitado solo por el padding. */}
          <main className="relative w-full flex-1 bg-one-dots bg-one-dots-size bg-fixed px-8 py-8">
            <div className="relative">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
