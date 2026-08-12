import Link from 'next/link';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function AdminHomePage() {
  const supabase = createSupabaseServiceClient();

  const [
    { count: campanasActivas },
    { count: leadsRecientes },
    { count: enviosConError },
    { count: enviosPendientes },
    { data: ultimosLeads },
  ] = await Promise.all([
    supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    supabase.from('email_sends').select('*', { count: 'exact', head: true }).eq('status', 'error'),
    supabase.from('email_sends').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase
      .from('leads')
      .select('id, first_name, last_name, email, created_at, campaigns(name, landings(slug))')
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  const tarjetas = [
    { label: 'Campañas activas', valor: campanasActivas ?? 0 },
    { label: 'Leads últimos 7 días', valor: leadsRecientes ?? 0 },
    { label: 'Envíos pendientes', valor: enviosPendientes ?? 0 },
    { label: 'Envíos con error', valor: enviosConError ?? 0, alerta: (enviosConError ?? 0) > 0 },
  ];

  return (
    <div>
      <h1 className="text-xl font-extrabold text-one-oscuro">Resumen</h1>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tarjetas.map((t) => (
          <div key={t.label} className="rounded-one-lg bg-one-oscuro/5 p-5">
            <p className="text-sm text-one-oscuro/60">{t.label}</p>
            <p
              className={`mt-1 text-2xl font-extrabold ${t.alerta ? 'text-one-rojo' : 'text-one-oscuro'}`}
            >
              {t.valor}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/admin/campaigns/new"
          prefetch={false}
          className="rounded-full bg-one-fucsia px-6 py-2.5 text-sm font-bold text-one-negro transition-all duration-300 hover:-translate-y-0.5"
        >
          + Nueva campaña
        </Link>
        <Link
          href="/admin/templates/new"
          prefetch={false}
          className="rounded-full border border-one-oscuro/15 px-6 py-2.5 text-sm font-bold text-one-oscuro transition-all duration-300 hover:-translate-y-0.5 hover:bg-one-oscuro/5"
        >
          + Nueva plantilla
        </Link>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-bold text-one-oscuro">Últimos leads</h2>
        <div className="mt-3 overflow-hidden rounded-one-lg bg-one-oscuro/5">
          <table className="w-full text-sm">
            <thead className="text-left text-one-oscuro/50">
              <tr>
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Campaña</th>
                <th className="px-4 py-3 font-semibold">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {(ultimosLeads ?? []).map((lead) => {
                const campana = lead.campaigns as unknown as {
                  name: string;
                  landings: { slug: string } | null;
                } | null;
                return (
                  <tr key={lead.id} className="border-t border-one-oscuro/5">
                    <td className="px-4 py-3 text-one-oscuro">
                      {lead.first_name} {lead.last_name}
                    </td>
                    <td className="px-4 py-3 text-one-oscuro/60">{lead.email}</td>
                    <td className="px-4 py-3 text-one-oscuro/60">
                      {campana?.name ?? '—'}
                      {campana?.landings?.slug && (
                        <span className="text-one-oscuro/40"> (/{campana.landings.slug})</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-one-oscuro/60">
                      {new Date(lead.created_at).toLocaleString('es-AR')}
                    </td>
                  </tr>
                );
              })}
              {(ultimosLeads ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-one-oscuro/40">
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
