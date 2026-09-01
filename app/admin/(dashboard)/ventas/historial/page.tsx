import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { VentasTabs } from '../VentasTabs';
import { TableShell, TableHead, TableEmptyRow } from '../../AdminTable';
import { formatFechaHoraAR } from '@/lib/fecha';
import { RestablecerButton } from './RestablecerButton';

export const dynamic = 'force-dynamic';

const LIMITE = 100;

/**
 * Historial de ventas ya revisadas (2026-09-01, pedido explícito: "que
 * quede esa opción también de ver los leads [ventas], por más de que
 * ya se haya cambiado... y si se puede restablecer y cambiar la
 * situación") — todas las confirmadas y rechazadas, no solo las
 * últimas 10 que se ven en Analítica, con la opción de deshacer una
 * decisión tomada por error.
 */
export default async function HistorialVentasPage() {
  const supabase = createSupabaseServiceClient();

  const { data: historial, count } = await supabase
    .from('ventas')
    .select(
      'id, nombre, apellido, email, programa, monto, marca_temporal, estado, revisado_en, campaign:campaigns(name)',
      { count: 'exact' }
    )
    .in('estado', ['confirmada', 'rechazada'])
    .order('revisado_en', { ascending: false })
    .limit(LIMITE);

  const filas = historial ?? [];

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight text-one-oscuro">Ventas</h1>
      <VentasTabs />

      <p className="mt-5 text-sm text-one-oscuro/60">
        {filas.length === 0
          ? 'Todavía no revisaste ninguna venta.'
          : `${count ?? filas.length} ${(count ?? filas.length) === 1 ? 'venta revisada' : 'ventas revisadas'}${
              (count ?? 0) > LIMITE ? ` (mostrando las ${LIMITE} más recientes)` : ''
            }. Si confirmaste o rechazaste algo por error, lo restablecés desde acá.`}
      </p>

      <TableShell>
        <TableHead columns={['Estado', 'Nombre', 'Programa', 'Campaña', 'Monto', 'Revisado', '']} />
        <tbody>
          {filas.map((v, i) => {
            const camp = v.campaign as unknown as { name: string } | null;
            return (
              <tr
                key={v.id}
                style={{ '--stagger-index': i } as React.CSSProperties}
                className="stagger-in table-row-hover border-t border-one-oscuro/5"
              >
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      v.estado === 'confirmada' ? 'bg-emerald-50 text-emerald-600' : 'bg-one-oscuro/5 text-one-oscuro/50'
                    }`}
                  >
                    {v.estado === 'confirmada' ? 'Confirmada' : 'Rechazada'}
                  </span>
                </td>
                <td className="px-4 py-3 text-one-oscuro">
                  {v.nombre} {v.apellido}
                  {v.email && <span className="ml-1.5 text-xs text-one-oscuro/40">{v.email}</span>}
                </td>
                <td className="px-4 py-3 text-one-oscuro/60">
                  <span className="block max-w-[220px] truncate" title={v.programa ?? undefined}>
                    {v.programa ?? '—'}
                  </span>
                </td>
                <td className="px-4 py-3 text-one-oscuro/60">{camp?.name ?? '—'}</td>
                <td className="px-4 py-3 text-one-oscuro/60">{v.monto ?? '—'}</td>
                <td className="px-4 py-3 text-one-oscuro/50">{v.revisado_en ? formatFechaHoraAR(v.revisado_en) : '—'}</td>
                <td className="px-4 py-3">
                  <RestablecerButton ventaId={v.id} />
                </td>
              </tr>
            );
          })}
          {filas.length === 0 && (
            <TableEmptyRow colSpan={7}>Todavía no confirmaste ni rechazaste ninguna venta.</TableEmptyRow>
          )}
        </tbody>
      </TableShell>
    </div>
  );
}
