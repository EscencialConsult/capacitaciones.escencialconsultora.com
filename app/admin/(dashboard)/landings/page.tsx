import Link from 'next/link';
import { Pencil } from 'lucide-react';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { EnviarPendientesButton } from './EnviarPendientesButton';
import { LandingToggleActivaButton } from './LandingToggleActivaButton';
import { deleteLanding } from './actions';
import { DeleteButton } from '../DeleteButton';
import { iconActionClass, IconActionGlyph } from '../IconAction';
import { TableShell, TableHead, TableEmptyRow } from '../AdminTable';

export const dynamic = 'force-dynamic';

// El link público en sí — nombre, categoría, plantilla, estado, y qué
// campaña está conectada (si hay alguna). Independiente de cualquier
// campaña: se crea acá, y una campaña se conecta a una landing ya
// existente después (ver /admin/campaigns). Lista TODAS las landings,
// no solo las que ya tuvieron alguna campaña activada.
export default async function LandingsPage() {
  const supabase = createSupabaseServiceClient();

  const { data: landings } = await supabase
    .from('landings')
    .select('id, slug, name, is_active, landing_templates(name), campaigns(id, name, status)')
    .order('created_at', { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-one-oscuro">Landings</h1>
          <p className="mt-1 text-sm text-one-oscuro/60">
            El link público en sí — el contenido y los leads viven en la campaña conectada, ver
            Campañas.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <EnviarPendientesButton />
          <Link
            href="/admin/landings/new"
            className="rounded-full bg-one-fucsia px-6 py-2.5 text-sm font-bold text-one-negro transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-one-fucsia"
          >
            + Nueva landing
          </Link>
        </div>
      </div>

      <TableShell>
        <TableHead columns={['Link', 'Nombre', 'Plantilla', 'Estado', 'Campaña conectada', '']} />
        <tbody>
            {(landings ?? []).map((l) => {
              const plantilla = l.landing_templates as unknown as { name: string } | null;
              const campanas = (l.campaigns as unknown as { id: string; name: string; status: string }[]) ?? [];
              const campanaActiva = campanas.find((c) => c.status === 'active');
              return (
                <tr key={l.id} className="table-row-hover border-t border-one-oscuro/5">
                  {/* Bug real confirmado (2026-08-25) — sin truncar, un texto
                      largo pasaba a 2 líneas y esa fila quedaba más alta que
                      el resto, descuadrando toda la tabla. max-w + truncate
                      deja TODAS las filas a la misma altura; el texto
                      completo sigue disponible con el `title` nativo. */}
                  <td className="px-4 py-3">
                    <a
                      href={`/${l.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      title={`/${l.slug}`}
                      className="block max-w-[160px] truncate font-medium text-one-oscuro transition-colors duration-150 hover:text-one-fucsia hover:underline"
                    >
                      /{l.slug}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-one-oscuro">
                    <span className="block max-w-xs truncate" title={l.name}>
                      {l.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-one-oscuro/60">
                    <span className="block max-w-[160px] truncate" title={plantilla?.name}>
                      {plantilla?.name ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-one-sm px-2 py-0.5 text-xs font-semibold ${
                        l.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-one-oscuro/5 text-one-oscuro/50'
                      }`}
                    >
                      {l.is_active ? 'activa' : 'inactiva'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {campanaActiva ? (
                      <Link
                        href={`/admin/campaigns/${campanaActiva.id}/leads`}
                        title={campanaActiva.name}
                        className="block max-w-[160px] truncate text-one-oscuro/70 transition-colors duration-150 hover:text-one-fucsia hover:underline"
                      >
                        {campanaActiva.name}
                      </Link>
                    ) : (
                      <span className="text-one-oscuro/40">— Ninguna activa —</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/admin/landings/${l.id}/edit`}
                        title="Editar"
                        aria-label={`Editar ${l.name}`}
                        className={iconActionClass()}
                      >
                        <IconActionGlyph icon={Pencil} />
                      </Link>
                      <LandingToggleActivaButton
                        landingId={l.id}
                        activa={l.is_active}
                        tieneCampanaActiva={!!campanaActiva}
                      />
                      <DeleteButton itemLabel={`la landing "${l.name}"`} onDelete={deleteLanding.bind(null, l.id)} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {(landings ?? []).length === 0 && (
              <TableEmptyRow colSpan={6}>Todavía no hay ninguna landing creada. Creá la primera para arrancar.</TableEmptyRow>
            )}
          </tbody>
      </TableShell>
    </div>
  );
}
