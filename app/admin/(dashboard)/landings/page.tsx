import Link from 'next/link';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { EnviarPendientesButton } from './EnviarPendientesButton';
import { LandingToggleActivaButton } from './LandingToggleActivaButton';

export const dynamic = 'force-dynamic';

// El link público en sí — nombre, categoría, plantilla, estado, y qué
// campaña está conectada (si hay alguna). Independiente de cualquier
// campaña: se crea acá, y una campaña se conecta a una landing ya
// existente después (ver /admin/campaigns). Lista TODAS las landings,
// no solo las que ya tuvieron alguna campaña activada.
export default async function LandingsPage() {
  const supabase = createSupabaseServiceClient();

  const { data: landings } = await supabase
    .from('landings')
    .select('id, slug, name, is_active, landing_categories(name), landing_templates(name), campaigns(id, name, status)')
    .order('created_at', { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-extrabold text-one-oscuro">Landings</h1>
          <p className="mt-1 text-sm text-one-oscuro/60">
            El link público en sí — el contenido y los leads viven en la campaña conectada, ver
            Campañas.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <EnviarPendientesButton />
          <Link
            href="/admin/landings/new"
            prefetch={false}
            className="rounded-full bg-one-fucsia px-6 py-2.5 text-sm font-bold text-one-negro transition-all duration-300 hover:-translate-y-0.5"
          >
            + Nueva landing
          </Link>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-one-lg bg-one-oscuro/5">
        <table className="w-full text-sm">
          <thead className="text-left text-one-oscuro/50">
            <tr>
              <th className="px-4 py-3 font-semibold">Link</th>
              <th className="px-4 py-3 font-semibold">Nombre</th>
              <th className="px-4 py-3 font-semibold">Categoría</th>
              <th className="px-4 py-3 font-semibold">Plantilla</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Campaña conectada</th>
              <th className="px-4 py-3 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {(landings ?? []).map((l) => {
              const categoria = l.landing_categories as unknown as { name: string } | null;
              const plantilla = l.landing_templates as unknown as { name: string } | null;
              const campanas = (l.campaigns as unknown as { id: string; name: string; status: string }[]) ?? [];
              const campanaActiva = campanas.find((c) => c.status === 'active');
              return (
                <tr key={l.id} className="border-t border-one-oscuro/5">
                  <td className="px-4 py-3">
                    <a
                      href={`/${l.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-one-fucsia hover:underline"
                    >
                      /{l.slug}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-one-oscuro">{l.name}</td>
                  <td className="px-4 py-3 text-one-oscuro/60">{categoria?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-one-oscuro/60">{plantilla?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        l.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-one-oscuro/5 text-one-oscuro/50'
                      }`}
                    >
                      {l.is_active ? 'activa' : 'inactiva'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {campanaActiva ? (
                      <Link
                        href={`/admin/campaigns/${campanaActiva.id}/leads`}
                        prefetch={false}
                        className="text-one-fucsia hover:underline"
                      >
                        {campanaActiva.name}
                      </Link>
                    ) : (
                      <span className="text-one-oscuro/40">— Ninguna activa —</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/admin/landings/${l.id}/edit`}
                        prefetch={false}
                        className="text-one-fucsia hover:underline"
                      >
                        Editar
                      </Link>
                      <LandingToggleActivaButton landingId={l.id} activa={l.is_active} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {(landings ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-one-oscuro/40">
                  Todavía no hay ninguna landing creada. Creá la primera para arrancar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
