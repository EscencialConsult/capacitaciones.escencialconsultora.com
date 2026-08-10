import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function AdminHomePage() {
  const supabase = createSupabaseServerClient();

  const [{ count: landingsActivas }, { count: leadsRecientes }, { count: enviosConError }] =
    await Promise.all([
      supabase.from('landings').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      supabase.from('email_sends').select('*', { count: 'exact', head: true }).eq('status', 'error'),
    ]);

  const tarjetas = [
    { label: 'Landings activas', valor: landingsActivas ?? 0 },
    { label: 'Leads últimos 7 días', valor: leadsRecientes ?? 0 },
    { label: 'Envíos con error', valor: enviosConError ?? 0, alerta: (enviosConError ?? 0) > 0 },
  ];

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-800">Resumen</h1>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {tarjetas.map((t) => (
          <div key={t.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">{t.label}</p>
            <p className={`mt-1 text-2xl font-semibold ${t.alerta ? 'text-red-600' : 'text-slate-800'}`}>
              {t.valor}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <Link
          href="/admin/landings"
          className="inline-block rounded-lg bg-azul px-4 py-2 text-sm font-semibold text-white hover:bg-azul-oscuro"
        >
          Ver landings
        </Link>
      </div>
    </div>
  );
}
