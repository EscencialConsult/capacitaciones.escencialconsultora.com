import Link from 'next/link';
import { ClipboardList, Users, Clock, TriangleAlert } from 'lucide-react';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { TableShell, TableHead, TableEmptyRow } from './AdminTable';
import { formatFechaHoraAR } from '@/lib/fecha';

export const dynamic = 'force-dynamic';

// Rediseño 2026-08-24 (DESIGN.md) — un ícono + color por tarjeta, tomado de
// la paleta secundaria (cian/dorado) que el sistema pedía usar más fuera
// del login; el rojo queda reservado para cuando de verdad hay error
// (severidad real, no decoración). Ninguna usa fucsia — ese acento ya lo
// tiene el botón "+ Nueva campaña" de abajo (Regla de la Rareza Fucsia).
const ICONOS = {
  campanas: { Icon: ClipboardList, clase: 'bg-one-cian/15 text-one-cian' },
  leads: { Icon: Users, clase: 'bg-one-dorado/15 text-one-dorado' },
  pendientes: { Icon: Clock, clase: 'bg-one-oscuro/10 text-one-oscuro/60' },
  error: { Icon: TriangleAlert, clase: 'bg-one-rojo/15 text-one-rojo' },
} as const;

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
    { label: 'Campañas activas', valor: campanasActivas ?? 0, icono: 'campanas' as const },
    { label: 'Leads últimos 7 días', valor: leadsRecientes ?? 0, icono: 'leads' as const },
    { label: 'Envíos pendientes', valor: enviosPendientes ?? 0, icono: 'pendientes' as const },
    {
      label: 'Envíos con error',
      valor: enviosConError ?? 0,
      alerta: (enviosConError ?? 0) > 0,
      icono: 'error' as const,
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight text-one-oscuro">Resumen</h1>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tarjetas.map((t, i) => {
          const { Icon, clase } = ICONOS[t.icono];
          return (
            <div
              key={t.label}
              style={{ '--stagger-index': i } as React.CSSProperties}
              className="stagger-in rounded-one-lg bg-one-blanco p-5 shadow-one-sm ring-1 ring-one-oscuro/5 transition-shadow duration-200 ease-out hover:shadow-one-md"
            >
              <div className={`flex size-9 items-center justify-center rounded-one-sm ${clase}`}>
                <Icon className="size-5" strokeWidth={2} />
              </div>
              <p className="mt-3 text-sm text-one-oscuro/60">{t.label}</p>
              <p className={`mt-0.5 text-2xl font-extrabold ${t.alerta ? 'text-one-rojo' : 'text-one-oscuro'}`}>
                {t.valor}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/admin/campaigns/new"
          className="rounded-full bg-one-fucsia px-6 py-2.5 text-sm font-bold text-one-negro transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-one-fucsia"
        >
          + Nueva campaña
        </Link>
        <Link
          href="/admin/templates/new"
          className="rounded-full border border-one-oscuro/15 px-6 py-2.5 text-sm font-bold text-one-oscuro transition-[transform,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:bg-one-oscuro/5"
        >
          + Nueva plantilla
        </Link>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-bold text-one-oscuro">Últimos leads</h2>
        <TableShell>
            <TableHead columns={['Nombre', 'Email', 'Campaña', 'Fecha']} />
            <tbody>
              {(ultimosLeads ?? []).map((lead) => {
                const campana = lead.campaigns as unknown as {
                  name: string;
                  landings: { slug: string } | null;
                } | null;
                return (
                  <tr key={lead.id} className="table-row-hover border-t border-one-oscuro/5">
                    <td className="px-4 py-3 text-one-oscuro">
                      {lead.first_name} {lead.last_name}
                    </td>
                    <td className="px-4 py-3 text-one-oscuro/60">{lead.email ?? '—'}</td>
                    <td className="px-4 py-3 text-one-oscuro/60">
                      {campana?.name ?? '—'}
                      {campana?.landings?.slug && (
                        <span className="text-one-oscuro/40"> (/{campana.landings.slug})</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-one-oscuro/60">
                      {formatFechaHoraAR(lead.created_at)}
                    </td>
                  </tr>
                );
              })}
              {(ultimosLeads ?? []).length === 0 && <TableEmptyRow colSpan={4}>Todavía no hay leads.</TableEmptyRow>}
            </tbody>
        </TableShell>
      </div>
    </div>
  );
}
