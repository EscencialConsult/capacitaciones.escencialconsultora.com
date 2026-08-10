import Link from 'next/link';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const badgeEstado: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  sent: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
  skipped: 'bg-slate-100 text-slate-500',
};

export default async function LandingLeadsPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServiceClient();

  const [{ data: landing }, { data: leads }] = await Promise.all([
    supabase.from('landings').select('id, name, slug').eq('id', params.id).single(),
    supabase
      .from('leads')
      .select('id, first_name, last_name, email, phone, whatsapp_clicked_at, created_at, email_sends(status, scheduled_for)')
      .eq('landing_id', params.id)
      .order('created_at', { ascending: false }),
  ]);

  return (
    <div>
      <Link href="/admin/landings" prefetch={false} className="text-sm text-azul hover:underline">
        ← Volver a landings
      </Link>
      <h1 className="mt-2 text-lg font-semibold text-slate-800">
        Leads — {landing?.name ?? '...'} <span className="text-slate-400">(/{landing?.slug})</span>
      </h1>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Teléfono</th>
              <th className="px-4 py-3 font-medium">Click WhatsApp</th>
              <th className="px-4 py-3 font-medium">Envíos</th>
              <th className="px-4 py-3 font-medium">Ingresó</th>
            </tr>
          </thead>
          <tbody>
            {(leads ?? []).map((lead) => {
              const sends = (lead.email_sends as { status: string }[]) ?? [];
              return (
                <tr key={lead.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    {lead.first_name} {lead.last_name}
                  </td>
                  <td className="px-4 py-3">{lead.email}</td>
                  <td className="px-4 py-3 text-slate-500">{lead.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {lead.whatsapp_clicked_at
                      ? new Date(lead.whatsapp_clicked_at).toLocaleString('es-AR')
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {sends.map((s, i) => (
                        <span
                          key={i}
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeEstado[s.status] ?? ''}`}
                        >
                          {s.status}
                        </span>
                      ))}
                      {sends.length === 0 && <span className="text-slate-400">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(lead.created_at).toLocaleString('es-AR')}
                  </td>
                </tr>
              );
            })}
            {(leads ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Todavía no hay leads en esta landing.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
