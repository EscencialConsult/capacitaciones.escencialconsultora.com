import Link from 'next/link';
import { ArrowRight, TrendingUp, Clock, Check, X } from 'lucide-react';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { VentasTabs } from './VentasTabs';

export const dynamic = 'force-dynamic';

/**
 * Analítica de ventas (2026-09-01, pedido explícito: "el inicio de
 * este panel es todo el analytics, y este debe tener otra pestaña...
 * que es ver las ventas así los sincronizo") — la revisión/confirmación
 * en sí vive en /admin/ventas/revisar, ver VentasTabs.tsx.
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

export default async function VentasAnaliticaPage() {
  const supabase = createSupabaseServiceClient();

  const [
    { count: pendientes },
    { count: confirmadas },
    { count: rechazadas },
    { data: ventasConfirmadas },
  ] = await Promise.all([
    supabase.from('ventas').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente'),
    supabase.from('ventas').select('id', { count: 'exact', head: true }).eq('estado', 'confirmada'),
    supabase.from('ventas').select('id', { count: 'exact', head: true }).eq('estado', 'rechazada'),
    supabase
      .from('ventas')
      .select('monto, campaign_id, campaigns(name)')
      .eq('estado', 'confirmada'),
  ]);

  const confirmadasData = ventasConfirmadas ?? [];
  const totalFacturado = confirmadasData.reduce((acc, v) => acc + parsearMontoARS(v.monto), 0);

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

      <div className="mt-8">
        <h2 className="text-sm font-bold text-one-oscuro/70">Ranking de campañas</h2>
        <p className="mt-1 text-xs text-one-oscuro/40">
          Solo cuenta ventas ya confirmadas — una pendiente todavía no tiene campaña asignada.
        </p>

        {ranking.length === 0 ? (
          <div className="mt-3 rounded-one-lg border border-one-oscuro/10 bg-one-blanco/60 px-6 py-10 text-center text-sm text-one-oscuro/50">
            Todavía no hay ninguna venta confirmada — cuando confirmes la primera en{' '}
            <Link href="/admin/ventas/revisar" className="font-semibold text-one-fucsia hover:underline">
              Revisar y sincronizar
            </Link>
            , va a aparecer acá.
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-1.5">
            {ranking.map((c, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-one-sm border border-one-oscuro/5 bg-one-blanco px-4 py-3 text-sm"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-one-oscuro/5 text-xs font-bold text-one-oscuro/50">
                  {i + 1}
                </span>
                <span className="font-semibold text-one-oscuro">{c.nombre}</span>
                <span className="ml-auto text-one-oscuro/50">
                  {c.cantidad} {c.cantidad === 1 ? 'venta' : 'ventas'}
                </span>
                <span className="w-24 text-right font-semibold text-one-oscuro/70">{formatARS(c.monto)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
