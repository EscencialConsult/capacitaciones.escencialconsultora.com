import Link from 'next/link';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { EnviarPendientesButton } from './EnviarPendientesButton';

export const dynamic = 'force-dynamic';

const badgeEstado: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-600',
  paused: 'bg-amber-50 text-amber-600',
  archived: 'bg-one-oscuro/5 text-one-oscuro/40',
};

// Acá solo aparecen landings que YA fueron activadas alguna vez (tienen
// o tuvieron link público de verdad) — el armado de contenido (asesora,
// emails, diseño) pasó a vivir en /admin/campaigns mientras estaba en
// borrador. Acá el foco es analytics/estado, no edición de contenido.
export default async function LandingsPage() {
  const supabase = createSupabaseServiceClient();

  const { data: landings } = await supabase
    .from('landings')
    .select('id, slug, name, status, landing_templates(name)')
    .in('status', ['active', 'paused', 'archived'])
    .order('created_at', { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-extrabold text-one-oscuro">Landings</h1>
          <p className="mt-1 text-sm text-one-oscuro/60">
            Campañas ya activadas, con link público real. Para armar una nueva desde cero, andá a
            Campañas.
          </p>
        </div>
        <EnviarPendientesButton />
      </div>

      <div className="mt-6 overflow-hidden rounded-one-lg bg-one-oscuro/5">
        <table className="w-full text-sm">
          <thead className="text-left text-one-oscuro/50">
            <tr>
              <th className="px-4 py-3 font-semibold">Link</th>
              <th className="px-4 py-3 font-semibold">Nombre</th>
              <th className="px-4 py-3 font-semibold">Plantilla</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Leads</th>
            </tr>
          </thead>
          <tbody>
            {(landings ?? []).map((l) => {
              const template = l.landing_templates as unknown as { name: string } | null;
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
                  <td className="px-4 py-3 text-one-oscuro/60">{template?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeEstado[l.status] ?? ''}`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/landings/${l.id}/leads`}
                      prefetch={false}
                      className="text-one-fucsia hover:underline"
                    >
                      Ver leads
                    </Link>
                  </td>
                </tr>
              );
            })}
            {(landings ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-one-oscuro/40">
                  Todavía no hay ninguna landing activada. Armala primero en Campañas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
