import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function AdminHomePage() {
  const supabase = createSupabaseServerClient();

  const [
    { count: landingsActivas },
    { count: leadsRecientes },
    { count: enviosConError },
    { count: enviosPendientes },
    { data: ultimosLeads },
  ] = await Promise.all([
    supabase.from('landings').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    supabase.from('email_sends').select('*', { count: 'exact', head: true }).eq('status', 'error'),
    supabase.from('email_sends').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase
      .from('leads')
      .select('id, first_name, last_name, email, created_at, landings(name, slug)')
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  const tarjetas = [
    { label: 'Landings activas', valor: landingsActivas ?? 0 },
    { label: 'Leads últimos 7 días', valor: leadsRecientes ?? 0 },
    { label: 'Envíos pendientes', valor: enviosPendientes ?? 0 },
    { label: 'Envíos con error', valor: enviosConError ?? 0, alerta: (enviosConError ?? 0) > 0 },
  ];

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-800">Resumen</h1>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tarjetas.map((t) => (
          <div key={t.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">{t.label}</p>
            <p className={`mt-1 text-2xl font-semibold ${t.alerta ? 'text-red-600' : 'text-slate-800'}`}>
              {t.valor}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/admin/landings/new"
          className="rounded-lg bg-azul px-4 py-2 text-sm font-semibold text-white hover:bg-azul-oscuro"
        >
          + Nueva landing
        </Link>
        <Link
          href="/admin/templates/new"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          + Nueva plantilla
        </Link>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold text-slate-800">Últimos leads</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Landing</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {(ultimosLeads ?? []).map((lead) => {
                const landing = lead.landings as unknown as { name: string; slug: string } | null;
                return (
                  <tr key={lead.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      {lead.first_name} {lead.last_name}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{lead.email}</td>
                    <td className="px-4 py-3 text-slate-500">{landing?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(lead.created_at).toLocaleString('es-AR')}
                    </td>
                  </tr>
                );
              })}
              {(ultimosLeads ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                    Todavía no hay leads.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
