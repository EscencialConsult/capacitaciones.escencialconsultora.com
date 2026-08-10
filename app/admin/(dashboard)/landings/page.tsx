import Link from 'next/link';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { EnviarPendientesButton } from './EnviarPendientesButton';

export const dynamic = 'force-dynamic';

const badgeEstado: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  archived: 'bg-slate-100 text-slate-400',
};

export default async function LandingsPage() {
  const supabase = createSupabaseServiceClient();

  const { data: landings } = await supabase
    .from('landings')
    .select('id, slug, name, status, landing_templates(name)')
    .order('created_at', { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">Landings</h1>
        <div className="flex gap-3">
          <EnviarPendientesButton />
          <Link
            href="/admin/landings/new"
          prefetch={false}
            className="rounded-lg bg-azul px-4 py-2 text-sm font-semibold text-white hover:bg-azul-oscuro"
          >
            + Nueva landing
          </Link>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Link</th>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Plantilla</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Leads</th>
            </tr>
          </thead>
          <tbody>
            {(landings ?? []).map((l) => {
              const template = l.landing_templates as unknown as { name: string } | null;
              return (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <a
                      href={`/${l.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-azul hover:underline"
                    >
                      /{l.slug}
                    </a>
                  </td>
                  <td className="px-4 py-3">{l.name}</td>
                  <td className="px-4 py-3 text-slate-500">{template?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeEstado[l.status]}`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/landings/${l.id}/leads`} prefetch={false} className="text-azul hover:underline">
                      Ver leads
                    </Link>
                  </td>
                </tr>
              );
            })}
            {(landings ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  Todavía no hay landings creadas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
