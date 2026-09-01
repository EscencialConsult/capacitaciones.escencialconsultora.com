'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { TableShell, TableHead, TableEmptyRow } from '../../AdminTable';
import { formatFechaHoraAR } from '@/lib/fecha';
import { VentaDetalleModal } from './VentaDetalleModal';

const ETIQUETA_SENAL: Record<string, string> = {
  email: 'Email',
  telefono: 'Teléfono',
  tema_fecha_nombre: 'Tema + fecha + nombre',
};

export type LeadSugerido = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  campaign_id: string;
  campaigns: { name: string; landings: { name: string } | null } | null;
} | null;

export type VentaPendiente = {
  id: string;
  marca_temporal: string;
  nombre: string | null;
  apellido: string | null;
  dni: string | null;
  email: string | null;
  celular: string | null;
  programa: string | null;
  origen: string | null;
  monto: string | null;
  senales: string[];
  lead_sugerido: unknown;
};

/**
 * Lista compacta + panel de detalle (2026-09-01, pedido explícito
 * viendo la interfaz real) — antes cada venta se mostraba como una
 * tarjeta grande siempre abierta; ahora es una fila por venta, clic
 * abre el panel de comparación (VentaDetalleModal). Al confirmar o
 * rechazar desde el panel, la fila desaparece de la lista al toque
 * (estado local, `onResuelto`) — no hace falta esperar a que la
 * página entera se vuelva a cargar para ver el resultado.
 */
export function ListaVentasPendientes({ pendientes }: { pendientes: VentaPendiente[] }) {
  const [resueltas, setResueltas] = useState<Set<string>>(new Set());
  const [seleccionada, setSeleccionada] = useState<VentaPendiente | null>(null);

  const visibles = pendientes.filter((v) => !resueltas.has(v.id));

  return (
    <>
      <TableShell>
        <TableHead columns={['Nombre', 'Programa', 'Coincidencia', 'Monto', 'Fecha']} />
        <tbody>
          {visibles.map((venta, i) => {
            const lead = venta.lead_sugerido as LeadSugerido;
            const senalesTexto = (venta.senales ?? []).join('_');
            const etiqueta = ETIQUETA_SENAL[senalesTexto] ?? 'Coincidencia';
            return (
              <tr
                key={venta.id}
                style={{ '--stagger-index': i } as React.CSSProperties}
                onClick={() => setSeleccionada(venta)}
                className="stagger-in table-row-hover cursor-pointer border-t border-one-oscuro/5"
              >
                <td className="px-4 py-3 text-one-oscuro">
                  {venta.nombre ?? 'Sin nombre'} {venta.apellido ?? ''}
                </td>
                <td className="px-4 py-3 text-one-oscuro/60">
                  <span className="block max-w-[220px] truncate" title={venta.programa ?? undefined}>
                    {venta.programa ?? '—'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-one-cian/10 px-2 py-0.5 text-xs font-semibold text-one-cian">
                    <Sparkles className="size-3" strokeWidth={2} />
                    {etiqueta}
                  </span>
                  {lead && (
                    <span className="ml-1.5 text-xs text-one-oscuro/40">
                      → {lead.first_name} {lead.last_name}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-one-oscuro/60">{venta.monto ?? '—'}</td>
                <td className="px-4 py-3 text-one-oscuro/50">{formatFechaHoraAR(venta.marca_temporal)}</td>
              </tr>
            );
          })}
          {visibles.length === 0 && (
            <TableEmptyRow colSpan={5}>
              {resueltas.size > 0
                ? 'Ya revisaste todas las de esta tanda — recargá la página si esperás más.'
                : 'Nada pendiente por ahora — cuando lleguen ventas nuevas que coincidan con algún lead, van a aparecer acá.'}
            </TableEmptyRow>
          )}
        </tbody>
      </TableShell>

      {seleccionada && (
        <VentaDetalleModal
          venta={seleccionada}
          onClose={() => setSeleccionada(null)}
          onResuelto={(id) => {
            setResueltas((prev) => new Set(prev).add(id));
            setSeleccionada(null);
          }}
        />
      )}
    </>
  );
}
