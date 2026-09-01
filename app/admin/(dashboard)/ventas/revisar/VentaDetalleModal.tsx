'use client';

import { useState, useTransition } from 'react';
import { X, Check, Search, Loader2 } from 'lucide-react';
import { confirmarVenta, rechazarVenta, buscarLeadsPorNombre, type LeadEncontrado } from './actions';
import { formatFechaHoraAR } from '@/lib/fecha';
import type { LeadSugerido, VentaPendiente } from './ListaVentasPendientes';

type Paso = 'sugerencia' | 'buscando';

/**
 * Panel de comparación (2026-09-01, pedido explícito viendo la
 * interfaz real: "arriba yo voy a ver el dato de leads... y debajo, el
 * otro dato con el que estás comparando, el de las ventas — así yo
 * manualmente compare") — arriba el lead (de nuestro sistema, con toda
 * su campaña), abajo la venta (tal cual llegó de la planilla), siempre
 * visible como referencia fija sea cual sea el modo. Confirmar un lead
 * ya confirma su campaña — un lead vive en UNA sola campaña, no hace
 * falta un paso separado de "elegir campaña".
 */
export function VentaDetalleModal({
  venta,
  onClose,
  onResuelto,
}: {
  venta: VentaPendiente;
  onClose: () => void;
  onResuelto: (ventaId: string) => void;
}) {
  const lead = venta.lead_sugerido as LeadSugerido;

  const [paso, setPaso] = useState<Paso>(lead ? 'sugerencia' : 'buscando');
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState<LeadEncontrado[]>([]);
  const [buscando, setBuscando] = useState(false);

  function confirmar(leadId: string, campaignId: string) {
    setBusy(true);
    setError('');
    startTransition(async () => {
      const r = await confirmarVenta(venta.id, leadId, campaignId);
      if (r && 'error' in r) {
        setError(r.error ?? 'No se pudo confirmar.');
        setBusy(false);
        return;
      }
      onResuelto(venta.id);
    });
  }

  function rechazar() {
    setBusy(true);
    setError('');
    startTransition(async () => {
      const r = await rechazarVenta(venta.id);
      if (r && 'error' in r) {
        setError(r.error ?? 'No se pudo rechazar.');
        setBusy(false);
        return;
      }
      onResuelto(venta.id);
    });
  }

  async function buscar(texto: string) {
    setQuery(texto);
    if (texto.trim().length < 2) {
      setResultados([]);
      return;
    }
    setBuscando(true);
    const r = await buscarLeadsPorNombre(texto);
    setResultados(r);
    setBuscando(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-one-oscuro/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="rise-in flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-one-lg bg-one-blanco shadow-one-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-one-oscuro/10 px-6 py-4">
          <h2 className="text-base font-extrabold text-one-oscuro">
            {venta.nombre ?? 'Sin nombre'} {venta.apellido ?? ''}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-full p-1.5 text-one-oscuro/40 transition-colors duration-150 hover:bg-one-oscuro/5 hover:text-one-oscuro"
          >
            <X className="size-4" strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Arriba — el lead de nuestro sistema (sugerido, o el buscador a mano) */}
          <div className="border-b border-one-oscuro/10 bg-one-cian/[0.04] px-6 py-4">
            <p className="text-xs font-bold tracking-wide text-one-oscuro/40 uppercase">Lead en tu sistema</p>

            {paso === 'sugerencia' && lead && (
              <div className="mt-2">
                <p className="text-sm font-semibold text-one-oscuro">
                  {lead.first_name} {lead.last_name}
                </p>
                <p className="mt-0.5 text-xs text-one-oscuro/60">
                  {lead.email ?? '—'} {lead.phone ? `· ${lead.phone}` : ''}
                </p>
                <p className="mt-1 text-xs text-one-oscuro/50">
                  Campaña <span className="font-semibold text-one-oscuro/70">{lead.campaigns?.name ?? '—'}</span>
                  {lead.campaigns?.landings?.name && ` (landing: ${lead.campaigns.landings.name})`} — entró el{' '}
                  {formatFechaHoraAR(lead.created_at)}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setPaso('buscando')}
                  className="mt-2 text-xs font-semibold text-one-oscuro/50 underline transition-colors duration-150 hover:text-one-oscuro disabled:pointer-events-none disabled:opacity-50"
                >
                  No es esta persona — buscar otra
                </button>
              </div>
            )}

            {paso === 'buscando' && (
              <div className="mt-2">
                {!lead && (
                  <p className="mb-2 text-xs text-one-oscuro/50">
                    No se encontró ninguna coincidencia automática — buscá manualmente por nombre o apellido.
                  </p>
                )}
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-one-oscuro/30" />
                  <input
                    value={query}
                    onChange={(e) => buscar(e.target.value)}
                    autoFocus
                    placeholder="Buscar por nombre o apellido..."
                    className="w-full rounded-one-sm border border-one-oscuro/15 bg-one-blanco py-2 pr-3 pl-9 text-sm outline-none focus-visible:border-one-fucsia focus-visible:ring-2 focus-visible:ring-one-fucsia/40"
                  />
                </div>

                {buscando && <p className="mt-2 text-xs text-one-oscuro/40">Buscando...</p>}

                {resultados.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1.5">
                    {resultados.map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        disabled={busy}
                        onClick={() => confirmar(l.id, l.campaign_id)}
                        className="rounded-one-sm border border-one-oscuro/10 bg-one-blanco px-4 py-2.5 text-left text-sm transition-colors duration-150 hover:border-one-fucsia/40 hover:bg-one-fucsia/5 disabled:pointer-events-none disabled:opacity-50"
                      >
                        <span className="font-semibold text-one-oscuro">
                          {l.first_name} {l.last_name}
                        </span>
                        <span className="ml-2 text-xs text-one-oscuro/50">{l.email ?? l.phone ?? 'sin contacto'}</span>
                        <span className="mt-0.5 block text-xs text-one-oscuro/40">
                          {l.campaign_name} — entró el {formatFechaHoraAR(l.created_at)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {query.trim().length >= 2 && !buscando && resultados.length === 0 && (
                  <p className="mt-2 text-xs text-one-oscuro/40">Sin resultados para "{query}".</p>
                )}

                {lead && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setPaso('sugerencia');
                      setError('');
                    }}
                    className="mt-2 text-xs font-semibold text-one-oscuro/50 underline transition-colors duration-150 hover:text-one-oscuro disabled:pointer-events-none disabled:opacity-50"
                  >
                    Volver a la sugerencia
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Abajo — la venta, tal cual llegó de la planilla, siempre igual sea cual sea el modo de arriba */}
          <div className="px-6 py-4">
            <p className="text-xs font-bold tracking-wide text-one-oscuro/40 uppercase">Venta (planilla)</p>
            <div className="mt-2">
              <p className="text-sm font-semibold text-one-oscuro">
                {venta.nombre ?? 'Sin nombre'} {venta.apellido ?? ''}
              </p>
              <p className="mt-0.5 text-sm text-one-oscuro/60">{venta.programa ?? 'Sin programa especificado'}</p>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-one-oscuro/50">
                {venta.email && <span>{venta.email}</span>}
                {venta.celular && <span>{venta.celular}</span>}
                {venta.dni && <span>DNI {venta.dni}</span>}
                {venta.origen && <span>Origen: {venta.origen}</span>}
                {venta.monto && <span className="font-semibold text-one-oscuro/70">{venta.monto}</span>}
                <span>{formatFechaHoraAR(venta.marca_temporal)}</span>
              </div>
            </div>
          </div>
        </div>

        {error && <p className="px-6 pb-2 text-sm text-one-rojo">{error}</p>}

        <div className="flex flex-wrap items-center gap-2 border-t border-one-oscuro/10 px-6 py-4">
          {paso === 'sugerencia' && lead && (
            <button
              type="button"
              disabled={busy}
              onClick={() => confirmar(lead.id, lead.campaign_id)}
              className="inline-flex items-center gap-1.5 rounded-full bg-one-fucsia px-5 py-2.5 text-sm font-bold text-one-negro transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-one-md disabled:pointer-events-none disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" strokeWidth={2.5} />}
              Sí, es esta persona — confirmar
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={rechazar}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-one-rojo/25 px-4 py-2 text-sm font-bold text-one-rojo transition-colors duration-150 hover:bg-one-rojo/5 disabled:pointer-events-none disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" strokeWidth={2.5} />}
            Rechazar — no es un lead nuestro
          </button>
        </div>
      </div>
    </div>
  );
}
