import Link from 'next/link';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { ActivateButton } from './ActivateButton';

export const dynamic = 'force-dynamic';

const badgeEstado: Record<string, string> = {
  draft: 'bg-one-oscuro/5 text-one-oscuro/50',
  active: 'bg-emerald-50 text-emerald-600',
  paused: 'bg-amber-50 text-amber-600',
  archived: 'bg-one-oscuro/5 text-one-oscuro/40',
};

const textoEstado: Record<string, string> = {
  draft: 'Borrador',
  active: 'Activa',
  paused: 'Pausada',
  archived: 'Archivada',
};

// Acá viven TODAS las campañas — asesora, WhatsApp, los 4 emails, qué
// diseño usa, y los leads que capturó. A diferencia del diseño viejo,
// una campaña NUNCA desaparece de acá por activarse: sigue siendo la
// misma fila, solo cambia el badge de estado. El link público en sí
// (el "dónde" vive esta campaña) es la Landing conectada — ver
// /admin/landings.
export default async function CampaignsPage() {
  const supabase = createSupabaseServiceClient();

  const { data: campanas } = await supabase
    .from('campaigns')
    .select('id, name, status, landings(slug, name, landing_templates(name)), landing_email_steps(count)')
    .order('created_at', { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-extrabold text-one-oscuro">Campañas</h1>
          <p className="mt-1 text-sm text-one-oscuro/60">
            Asesora, WhatsApp, emails de seguimiento y leads de cada campaña — sin importar si ya
            está activa o todavía en borrador.
          </p>
        </div>
        <Link
          href="/admin/campaigns/new"
          prefetch={false}
          className="rounded-full bg-one-fucsia px-6 py-2.5 text-sm font-bold text-one-negro transition-all duration-300 hover:-translate-y-0.5"
        >
          + Nueva campaña
        </Link>
      </div>

      <div className="mt-6 overflow-hidden rounded-one-lg bg-one-oscuro/5">
        <table className="w-full text-sm">
          <thead className="text-left text-one-oscuro/50">
            <tr>
              <th className="px-4 py-3 font-semibold">Nombre</th>
              <th className="px-4 py-3 font-semibold">Landing</th>
              <th className="px-4 py-3 font-semibold">Plantilla</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Emails cargados</th>
              <th className="px-4 py-3 font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {(campanas ?? []).map((c) => {
              const landing = c.landings as unknown as {
                slug: string;
                name: string;
                landing_templates: { name: string } | null;
              } | null;
              const cantidadEmails = (c.landing_email_steps as unknown as { count: number }[])?.[0]?.count ?? 0;
              return (
                <tr key={c.id} className="border-t border-one-oscuro/5">
                  <td className="px-4 py-3 text-one-oscuro">{c.name}</td>
                  <td className="px-4 py-3 text-one-oscuro/50">
                    {landing ? `/${landing.slug}` : '— Sin landing —'}
                  </td>
                  <td className="px-4 py-3 text-one-oscuro/60">{landing?.landing_templates?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeEstado[c.status] ?? ''}`}>
                      {textoEstado[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-one-oscuro/60">{cantidadEmails}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {c.status === 'draft' && (
                        <Link
                          href={`/admin/campaigns/${c.id}/edit`}
                          prefetch={false}
                          className="text-one-fucsia hover:underline"
                        >
                          Editar
                        </Link>
                      )}
                      <Link
                        href={`/admin/campaigns/${c.id}/leads`}
                        prefetch={false}
                        className="text-one-fucsia hover:underline"
                      >
                        Ver leads
                      </Link>
                      {c.status === 'draft' && landing && (
                        <ActivateButton campaignId={c.id} slug={landing.slug} />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {(campanas ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-one-oscuro/40">
                  No hay ninguna campaña todavía. Creá una nueva para arrancar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
