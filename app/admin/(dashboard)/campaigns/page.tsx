import Link from 'next/link';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { ActivateButton } from './ActivateButton';
import { CampaignStatusButton } from './CampaignStatusButton';
import { pauseCampaign, archiveCampaign, deleteCampaign } from './actions';
import { DeleteButton } from '../DeleteButton';

export const dynamic = 'force-dynamic';

// Un solo color con significado real por estado (ver DESIGN.md → Badges):
// emerald para activo, one-dorado para "importante pero no es error" (pausada
// — necesita atención, no es una falla), neutro para el resto. Nunca amber
// (no es un color de esta paleta).
const badgeEstado: Record<string, string> = {
  draft: 'bg-one-oscuro/5 text-one-oscuro/50',
  active: 'bg-emerald-50 text-emerald-600',
  paused: 'bg-one-dorado/15 text-one-dorado',
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
    .select(
      'id, name, status, landing_categories(name), landings(slug, name, landing_templates(name)), landing_email_steps(count)'
    )
    .order('created_at', { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-one-oscuro">Campañas</h1>
          <p className="mt-1 text-sm text-one-oscuro/60">
            Asesora, WhatsApp, emails de seguimiento y leads de cada campaña — sin importar si ya
            está activa o todavía en borrador.
          </p>
        </div>
        <Link
          href="/admin/campaigns/new"
          className="rounded-full bg-one-fucsia px-6 py-2.5 text-sm font-bold text-one-negro transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-one-fucsia focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-one-fucsia/40"
        >
          + Nueva campaña
        </Link>
      </div>

      <div className="mt-6 overflow-hidden rounded-one-lg bg-one-blanco shadow-one-sm ring-1 ring-one-oscuro/5">
        <table className="w-full text-sm">
          <thead className="text-left text-xs font-semibold tracking-wide text-one-oscuro/50 uppercase">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Categoría</th>
              <th className="px-4 py-3">Landing</th>
              <th className="px-4 py-3">Plantilla</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Emails cargados</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {(campanas ?? []).map((c, i) => {
              const landing = c.landings as unknown as {
                slug: string;
                name: string;
                landing_templates: { name: string } | null;
              } | null;
              const cantidadEmails = (c.landing_email_steps as unknown as { count: number }[])?.[0]?.count ?? 0;
              const categoria = c.landing_categories as unknown as { name: string } | null;
              return (
                <tr
                  key={c.id}
                  style={{ '--stagger-index': i } as React.CSSProperties}
                  className="stagger-in table-row-hover border-t border-one-oscuro/5"
                >
                  <td className="px-4 py-3 text-one-oscuro">{c.name}</td>
                  <td className="px-4 py-3 text-one-oscuro/60">{categoria?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-one-oscuro/50">
                    {landing ? `/${landing.slug}` : '— Sin landing —'}
                  </td>
                  <td className="px-4 py-3 text-one-oscuro/60">{landing?.landing_templates?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badgeEstado[c.status] ?? ''}`}>
                      {textoEstado[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-one-oscuro/60">{cantidadEmails}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {/* Siempre visible — si la campaña ya no está en
                          borrador, el propio /edit redirige solo a Ver
                          leads (ver el guard en [id]/edit/page.tsx):
                          el contenido de una campaña activa no se toca
                          desde acá, ya tiene emails agendados contra
                          sus pasos actuales. */}
                      <Link
                        href={`/admin/campaigns/${c.id}/edit`}
                        className="rounded-one-sm font-semibold text-one-fucsia transition-colors duration-150 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-one-fucsia/40"
                      >
                        Editar
                      </Link>
                      <Link
                        href={`/admin/campaigns/${c.id}/leads`}
                        className="rounded-one-sm font-semibold text-one-fucsia transition-colors duration-150 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-one-fucsia/40"
                      >
                        Ver leads
                      </Link>
                      {(c.status === 'draft' || c.status === 'paused') && landing && (
                        <ActivateButton
                          campaignId={c.id}
                          slug={landing.slug}
                          label={c.status === 'paused' ? 'Reactivar' : 'Activar'}
                        />
                      )}
                      {c.status === 'active' && (
                        <CampaignStatusButton
                          label="Pausar"
                          pendingLabel="Pausando"
                          confirmMessage={`¿Pausar "${c.name}"? Deja de mostrarse en ${landing ? `/${landing.slug}` : 'su landing'} hasta que la reactives.`}
                          action={pauseCampaign.bind(null, c.id)}
                        />
                      )}
                      {c.status !== 'archived' && (
                        <CampaignStatusButton
                          label="Archivar"
                          pendingLabel="Archivando"
                          confirmMessage={`¿Archivar "${c.name}"? Se cierra el ciclo de esta campaña — se puede seguir consultando pero no se va a poder reactivar.`}
                          action={archiveCampaign.bind(null, c.id)}
                        />
                      )}
                      <DeleteButton itemLabel={`la campaña "${c.name}"`} onDelete={deleteCampaign.bind(null, c.id)} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {(campanas ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-one-oscuro/40">
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
