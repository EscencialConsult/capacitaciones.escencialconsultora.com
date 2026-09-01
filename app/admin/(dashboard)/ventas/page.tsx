import Link from 'next/link';
import { ArrowRight, TrendingUp, Clock, Check, X } from 'lucide-react';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { VentasTabs } from './VentasTabs';
import { BarrasHorizontales, BarrasComparativas, BarraApilada, TendenciaLinea, CHART_COLORS } from './Charts';
import { formatFechaAR } from '@/lib/fecha';

export const dynamic = 'force-dynamic';

/**
 * Analítica de ventas (2026-09-01, pedido explícito: "el inicio de
 * este panel es todo el analytics, y este debe tener otra pestaña...
 * que es ver las ventas así los sincronizo") — la revisión/confirmación
 * en sí vive en /admin/ventas/revisar, ver VentasTabs.tsx. Gráficos
 * agregados el mismo día ("vos decidí qué gráficos usarás") — ver
 * Charts.tsx para el criterio de forma/color de cada uno.
 *
 * Los números de acá solo cuentan lo CONFIRMADO — una venta pendiente
 * todavía no se sabe si corresponde a qué campaña (o si corresponde a
 * algún lead nuestro), así que mezclarla en la analítica mostraría
 * datos que todavía no son reales.
 */

// Formato real visto en la planilla: "$95.900", "16000", "23.000" — el
// "." es separador de miles (es-AR), no decimal, y no hay centavos en
// ningún ejemplo real. Sacar todo lo que no sea dígito alcanza.
function parsearMontoARS(texto: string | null): number {
  if (!texto) return 0;
  const limpio = texto.replace(/\D/g, '');
  if (!limpio) return 0;
  const n = parseInt(limpio, 10);
  return Number.isNaN(n) ? 0 : n;
}

function formatARS(n: number): string {
  return `$${n.toLocaleString('es-AR')}`;
}

const ETIQUETA_SENAL: Record<string, string> = {
  email: 'Email',
  telefono: 'Teléfono',
  tema_fecha_nombre: 'Tema + fecha + nombre',
};

export default async function VentasAnaliticaPage() {
  const supabase = createSupabaseServiceClient();

  const [
    { count: pendientes },
    { count: confirmadas },
    { count: rechazadas },
    { data: ventasConfirmadas },
    { data: leadsData },
    { data: senalesData },
    { data: revisadasRecientes },
  ] = await Promise.all([
    supabase.from('ventas').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente'),
    supabase.from('ventas').select('id', { count: 'exact', head: true }).eq('estado', 'confirmada'),
    supabase.from('ventas').select('id', { count: 'exact', head: true }).eq('estado', 'rechazada'),
    supabase
      .from('ventas')
      .select('monto, marca_temporal, campaign_id, campaigns(name)')
      .eq('estado', 'confirmada'),
    // Leads por campaña — para el gráfico comparativo de conversión
    // (leads vs. ventas confirmadas). Volumen chico hoy (decenas), no
    // vale la pena una función agregada en la base todavía.
    supabase.from('leads').select('campaign_id, campaigns(name)'),
    // Distribución por señal de matcheo — de TODO lo que sí generó
    // alguna sugerencia (pendiente/confirmada/rechazada), no de
    // 'sin_coincidencia' (esas no tienen señal por definición).
    supabase.from('ventas').select('senales').neq('estado', 'sin_coincidencia'),
    // "Revisadas hace poco" (2026-09-01, movida acá desde /revisar,
    // pedido explícito: "solo pendientes [en revisar], no los que ya
    // se haya aprobado, ya que eso se debería ver en otro apartado del
    // inicio de ventas").
    supabase
      .from('ventas')
      .select('id, nombre, apellido, programa, estado, revisado_en, campaign:campaigns(name)')
      .in('estado', ['confirmada', 'rechazada'])
      .order('revisado_en', { ascending: false })
      .limit(10),
  ]);

  const confirmadasData = ventasConfirmadas ?? [];
  const totalFacturado = confirmadasData.reduce((acc, v) => acc + parsearMontoARS(v.monto), 0);

  // Ranking de campañas por ventas confirmadas.
  const porCampana = new Map<string, { nombre: string; cantidad: number; monto: number }>();
  confirmadasData.forEach((v) => {
    if (!v.campaign_id) return;
    const nombre = (v.campaigns as unknown as { name: string } | null)?.name ?? '—';
    const actual = porCampana.get(v.campaign_id) ?? { nombre, cantidad: 0, monto: 0 };
    actual.cantidad += 1;
    actual.monto += parsearMontoARS(v.monto);
    porCampana.set(v.campaign_id, actual);
  });
  const ranking = Array.from(porCampana.values()).sort((a, b) => b.cantidad - a.cantidad);

  // Leads vs. ventas confirmadas por campaña (conversión visual) — top
  // 8 campañas por leads, para que el gráfico no se vuelva ilegible.
  const leadsPorCampana = new Map<string, { nombre: string; leads: number }>();
  (leadsData ?? []).forEach((l) => {
    if (!l.campaign_id) return;
    const nombre = (l.campaigns as unknown as { name: string } | null)?.name ?? '—';
    const actual = leadsPorCampana.get(l.campaign_id) ?? { nombre, leads: 0 };
    actual.leads += 1;
    leadsPorCampana.set(l.campaign_id, actual);
  });
  const comparativa = Array.from(leadsPorCampana.entries())
    .map(([campaignId, d]) => ({
      etiqueta: d.nombre,
      valores: [d.leads, porCampana.get(campaignId)?.cantidad ?? 0],
    }))
    .sort((a, b) => b.valores[0] - a.valores[0])
    .slice(0, 8);

  // Ventas confirmadas por día (tendencia) — agrupado por fecha (es-AR, sin hora).
  const porDia = new Map<string, number>();
  confirmadasData.forEach((v) => {
    const fecha = formatFechaAR(v.marca_temporal);
    porDia.set(fecha, (porDia.get(fecha) ?? 0) + 1);
  });
  const tendencia = Array.from(porDia.entries())
    .map(([fecha, valor]) => ({ fecha, valor, orden: new Date(fecha.split('/').reverse().join('-')).getTime() }))
    .sort((a, b) => a.orden - b.orden)
    .map(({ fecha, valor }) => ({ fecha, valor }));

  // Distribución por señal de matcheo.
  const senalesConteo = { email: 0, telefono: 0, tema_fecha_nombre: 0 };
  (senalesData ?? []).forEach((v) => {
    const s = ((v.senales as string[]) ?? []).join('_');
    if (s === 'email') senalesConteo.email++;
    else if (s === 'telefono') senalesConteo.telefono++;
    else if (s === 'tema_fecha_nombre') senalesConteo.tema_fecha_nombre++;
  });

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight text-one-oscuro">Ventas</h1>
      <VentasTabs />

      {(pendientes ?? 0) > 0 && (
        <Link
          href="/admin/ventas/revisar"
          className="mt-5 flex items-center justify-between gap-3 rounded-one-lg border border-one-fucsia/25 bg-one-fucsia/5 px-5 py-4 transition-colors duration-150 hover:bg-one-fucsia/10"
        >
          <span className="flex items-center gap-2.5 text-sm font-bold text-one-oscuro">
            <Clock className="size-4 text-one-fucsia" strokeWidth={2.5} />
            {pendientes} {pendientes === 1 ? 'venta pendiente' : 'ventas pendientes'} de revisar y sincronizar
          </span>
          <ArrowRight className="size-4 text-one-fucsia" strokeWidth={2.5} />
        </Link>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-one-lg border border-one-oscuro/10 bg-one-blanco p-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-one-oscuro/50">
            <Check className="size-3.5 text-emerald-600" strokeWidth={2.5} />
            Confirmadas
          </div>
          <p className="mt-2 text-2xl font-extrabold text-one-oscuro">{confirmadas ?? 0}</p>
        </div>
        <div className="rounded-one-lg border border-one-oscuro/10 bg-one-blanco p-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-one-oscuro/50">
            <Clock className="size-3.5 text-one-dorado" strokeWidth={2.5} />
            Pendientes
          </div>
          <p className="mt-2 text-2xl font-extrabold text-one-oscuro">{pendientes ?? 0}</p>
        </div>
        <div className="rounded-one-lg border border-one-oscuro/10 bg-one-blanco p-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-one-oscuro/50">
            <X className="size-3.5 text-one-oscuro/40" strokeWidth={2.5} />
            Rechazadas
          </div>
          <p className="mt-2 text-2xl font-extrabold text-one-oscuro">{rechazadas ?? 0}</p>
        </div>
        <div className="rounded-one-lg border border-one-oscuro/10 bg-one-blanco p-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-one-oscuro/50">
            <TrendingUp className="size-3.5 text-one-fucsia" strokeWidth={2.5} />
            Facturado (confirmadas)
          </div>
          <p className="mt-2 text-2xl font-extrabold text-one-oscuro">{formatARS(totalFacturado)}</p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-one-lg border border-one-oscuro/10 bg-one-blanco p-5">
          <h2 className="text-sm font-bold text-one-oscuro/70">Campañas con más ventas</h2>
          <p className="mt-1 text-xs text-one-oscuro/40">Solo cuenta ventas ya confirmadas.</p>
          <div className="mt-4">
            <BarrasHorizontales
              datos={ranking.map((c) => ({ etiqueta: c.nombre, valor: c.cantidad }))}
              vacio="Todavía no hay ninguna venta confirmada."
            />
          </div>
        </div>

        <div className="rounded-one-lg border border-one-oscuro/10 bg-one-blanco p-5">
          <h2 className="text-sm font-bold text-one-oscuro/70">Leads vs. ventas confirmadas</h2>
          <p className="mt-1 text-xs text-one-oscuro/40">Da una idea visual de conversión por campaña.</p>
          <div className="mt-4">
            <BarrasComparativas
              datos={comparativa}
              series={[
                { nombre: 'Leads', color: CHART_COLORS.cian },
                { nombre: 'Ventas confirmadas', color: CHART_COLORS.fucsia },
              ]}
            />
          </div>
        </div>

        <div className="rounded-one-lg border border-one-oscuro/10 bg-one-blanco p-5">
          <h2 className="text-sm font-bold text-one-oscuro/70">Ventas confirmadas por día</h2>
          <p className="mt-1 text-xs text-one-oscuro/40">Fecha real de la venta, no de cuándo se revisó.</p>
          <div className="mt-4">
            <TendenciaLinea datos={tendencia} />
          </div>
        </div>

        <div className="rounded-one-lg border border-one-oscuro/10 bg-one-blanco p-5">
          <h2 className="text-sm font-bold text-one-oscuro/70">Cómo matchea el sistema</h2>
          <p className="mt-1 text-xs text-one-oscuro/40">De todas las que generaron alguna sugerencia.</p>
          <div className="mt-4">
            <BarraApilada
              segmentos={[
                { etiqueta: ETIQUETA_SENAL.email, valor: senalesConteo.email, color: CHART_COLORS.fucsia },
                { etiqueta: ETIQUETA_SENAL.telefono, valor: senalesConteo.telefono, color: CHART_COLORS.cian },
                {
                  etiqueta: ETIQUETA_SENAL.tema_fecha_nombre,
                  valor: senalesConteo.tema_fecha_nombre,
                  color: CHART_COLORS.dorado,
                },
              ]}
            />
          </div>
        </div>
      </div>

      {(revisadasRecientes ?? []).length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-bold text-one-oscuro/70">Revisadas hace poco</h2>
          <div className="mt-3 flex flex-col gap-1.5">
            {(revisadasRecientes ?? []).map((v) => {
              const camp = v.campaign as unknown as { name: string } | null;
              return (
                <div
                  key={v.id}
                  className="flex items-center gap-3 rounded-one-sm border border-one-oscuro/5 bg-one-blanco/40 px-4 py-2 text-xs text-one-oscuro/60"
                >
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 font-semibold ${
                      v.estado === 'confirmada' ? 'bg-emerald-50 text-emerald-600' : 'bg-one-oscuro/5 text-one-oscuro/40'
                    }`}
                  >
                    {v.estado === 'confirmada' ? 'Confirmada' : 'Rechazada'}
                  </span>
                  <span className="text-one-oscuro">
                    {v.nombre} {v.apellido}
                  </span>
                  {v.programa && <span className="text-one-oscuro/40">— {v.programa}</span>}
                  {camp && <span className="ml-auto text-one-oscuro/40">{camp.name}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
