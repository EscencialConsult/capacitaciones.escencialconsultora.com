import Link from 'next/link';
import { Pencil, Contact, Pause, Archive } from 'lucide-react';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { ActivateButton } from './ActivateButton';
import { CampaignStatusButton } from './CampaignStatusButton';
import { pauseCampaign, archiveCampaign, deleteCampaign } from './actions';
import { DeleteButton } from '../DeleteButton';
import { iconActionClass, IconActionGlyph } from '../IconAction';
import { TableShell, TableHead, TableEmptyRow } from '../AdminTable';

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

      <TableShell>
        <TableHead columns={['Nombre', 'Categoría', 'Landing', 'Plantilla', 'Estado', 'Emails cargados', 'Acciones']} />
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
                  {/* Bug real confirmado (2026-08-25) — sin truncar, un nombre
                      largo (ej. "Servicio Prueba 1 — Tecnología Agosto 2026")
                      pasaba a 2 líneas y esa fila quedaba más alta que el
                      resto, descuadrando toda la tabla. max-w + truncate deja
                      TODAS las filas a la misma altura; el texto completo
                      sigue disponible con el `title` nativo al pasar el mouse. */}
                  <td className="px-4 py-3 text-one-oscuro">
                    <span className="block max-w-xs truncate" title={c.name}>
                      {c.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-one-oscuro/60">
                    <span className="block max-w-[140px] truncate" title={categoria?.name}>
                      {categoria?.name ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-one-oscuro/50">
                    <span className="block max-w-[160px] truncate" title={landing ? `/${landing.slug}` : undefined}>
                      {landing ? `/${landing.slug}` : '— Sin landing —'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-one-oscuro/60">
                    <span className="block max-w-[160px] truncate" title={landing?.landing_templates?.name}>
                      {landing?.landing_templates?.name ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badgeEstado[c.status] ?? ''}`}>
                      {textoEstado[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-one-oscuro/60">{cantidadEmails}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {/* Siempre visible — si la campaña ya no está en
                          borrador, el propio /edit redirige solo a Ver
                          leads (ver el guard en [id]/edit/page.tsx):
                          el contenido de una campaña activa no se toca
                          desde acá, ya tiene emails agendados contra
                          sus pasos actuales. */}
                      <Link
                        href={`/admin/campaigns/${c.id}/edit`}
                        title="Editar"
                        aria-label={`Editar ${c.name}`}
                        className={iconActionClass()}
                      >
                        <IconActionGlyph icon={Pencil} />
                      </Link>
                      <Link
                        href={`/admin/campaigns/${c.id}/leads`}
                        title="Ver leads"
                        aria-label={`Ver leads de ${c.name}`}
                        className={iconActionClass()}
                      >
                        <IconActionGlyph icon={Contact} />
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
                          confirmMessage={`¿Pausar "${c.name}"? Deja de mostrarse en ${landing ? `/${landing.slug}` : 'su landing'} hasta que la reactives.`}
                          action={pauseCampaign.bind(null, c.id)}
                        >
                          <Pause className="size-[18px]" strokeWidth={1.75} />
                        </CampaignStatusButton>
                      )}
                      {c.status !== 'archived' && (
                        <CampaignStatusButton
                          label="Archivar"
                          confirmMessage={`¿Archivar "${c.name}"? Se cierra el ciclo de esta campaña — se puede seguir consultando pero no se va a poder reactivar.`}
                          action={archiveCampaign.bind(null, c.id)}
                        >
                          <Archive className="size-[18px]" strokeWidth={1.75} />
                        </CampaignStatusButton>
                      )}
                      <DeleteButton itemLabel={`la campaña "${c.name}"`} onDelete={deleteCampaign.bind(null, c.id)} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {(campanas ?? []).length === 0 && (
              <TableEmptyRow colSpan={7}>No hay ninguna campaña todavía. Creá una nueva para arrancar.</TableEmptyRow>
            )}
          </tbody>
      </TableShell>
    </div>
  );
}
