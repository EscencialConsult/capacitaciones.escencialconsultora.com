'use client';

import { useState, useTransition } from 'react';
import { Check, X, Search, Sparkles, Loader2 } from 'lucide-react';
import { confirmarVenta, rechazarVenta, buscarLeadsPorNombre, type LeadEncontrado } from './actions';
import { formatFechaHoraAR } from '@/lib/fecha';

type Venta = {
  id: string;
  marcaTemporal: string;
  nombre: string | null;
  apellido: string | null;
  dni: string | null;
  email: string | null;
  celular: string | null;
  programa: string | null;
  origen: string | null;
  monto: string | null;
};

type LeadSugerido = {
  id: string;
  nombre: string | null;
  apellido: string | null;
  email: string | null;
  telefono: string | null;
  campaignId: string;
  campania: string;
  landing: string | null;
  ingreso: string;
};

type Paso = 'sugerencia' | 'buscando' | 'hecho_confirmada' | 'hecho_rechazada';

/**
 * Una fila de la cola de revisión (2026-09-01, ver /admin/ventas) —
 * dos pasos separados, pedido explícito de Facundo: (1) ¿es esta
 * persona?, y si no, (2) buscar a mano. Confirmar un lead ya confirma
 * su campaña también — un lead vive en UNA sola campaña (ver
 * leads.campaign_id), así que no hace falta un tercer paso de "elegir
 * campaña" aparte: la campaña queda decidida por CUÁL lead se elige,
 * no por una lista separada.
 */
export function RevisarVentaCard({
  venta,
  leadSugerido,
  etiquetaSenal,
}: {
  venta: Venta;
  leadSugerido: LeadSugerido | null;
  etiquetaSenal: string | null;
}) {
  const [paso, setPaso] = useState<Paso>(leadSugerido ? 'sugerencia' : 'buscando');
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
      setPaso('hecho_confirmada');
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
      setPaso('hecho_rechazada');
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

  if (paso === 'hecho_confirmada' || paso === 'hecho_rechazada') {
    return (
      <div className="flex items-center gap-3 rounded-one-lg border border-one-oscuro/10 bg-one-blanco/40 px-6 py-4 text-sm text-one-oscuro/50">
        <Check className="size-4 shrink-0 text-emerald-600" strokeWidth={3} />
        {paso === 'hecho_confirmada' ? 'Confirmada.' : 'Rechazada.'} {venta.nombre} {venta.apellido}
      </div>
    );
  }

  return (
    <div className="rounded-one-lg border border-one-oscuro/10 bg-one-blanco p-5 shadow-one-sm">
      {/* Datos de la venta, tal cual llegaron de la planilla */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-bold text-one-oscuro">
            {venta.nombre ?? 'Sin nombre'} {venta.apellido ?? ''}
          </p>
          <p className="mt-0.5 text-sm text-one-oscuro/60">{venta.programa ?? 'Sin programa especificado'}</p>
        </div>
        <div className="text-right text-xs text-one-oscuro/40">
          <p>{formatFechaHoraAR(venta.marcaTemporal)}</p>
          {venta.monto && <p className="font-semibold text-one-oscuro/60">{venta.monto}</p>}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-one-oscuro/50">
        {venta.email && <span>{venta.email}</span>}
        {venta.celular && <span>{venta.celular}</span>}
        {venta.dni && <span>DNI {venta.dni}</span>}
        {venta.origen && <span>Origen: {venta.origen}</span>}
      </div>

      <div className="mt-4 border-t border-one-oscuro/5 pt-4">
        {paso === 'sugerencia' && leadSugerido && (
          <>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-one-cian">
              <Sparkles className="size-3.5" strokeWidth={2} />
              Sugerencia — {etiquetaSenal ?? 'coincidencia encontrada'}
            </div>
            <div className="mt-2 rounded-one-sm bg-one-oscuro/[0.03] px-4 py-3">
              <p className="text-sm font-semibold text-one-oscuro">
                {leadSugerido.nombre} {leadSugerido.apellido}
              </p>
              <p className="mt-0.5 text-xs text-one-oscuro/60">
                {leadSugerido.email ?? '—'} {leadSugerido.telefono ? `· ${leadSugerido.telefono}` : ''}
              </p>
              <p className="mt-1 text-xs text-one-oscuro/50">
                Campaña <span className="font-semibold text-one-oscuro/70">{leadSugerido.campania}</span>
                {leadSugerido.landing && ` (landing: ${leadSugerido.landing})`} — entró el{' '}
                {formatFechaHoraAR(leadSugerido.ingreso)}
              </p>
            </div>

            {error && <p className="mt-2 text-sm text-one-rojo">{error}</p>}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => confirmar(leadSugerido.id, leadSugerido.campaignId)}
                className="inline-flex items-center gap-1.5 rounded-full bg-one-fucsia px-4 py-2 text-sm font-bold text-one-negro transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-one-md disabled:pointer-events-none disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" strokeWidth={2.5} />}
                Sí, es esta persona
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setPaso('buscando')}
                className="inline-flex items-center gap-1.5 rounded-full border border-one-oscuro/15 px-4 py-2 text-sm font-bold text-one-oscuro/70 transition-colors duration-150 hover:bg-one-oscuro/5 disabled:pointer-events-none disabled:opacity-50"
              >
                No es esta persona
              </button>
            </div>
          </>
        )}

        {paso === 'buscando' && (
          <>
            {!leadSugerido && (
              <p className="mb-2 text-xs text-one-oscuro/50">
                No se encontró ninguna coincidencia automática — buscá manualmente por nombre o apellido.
              </p>
            )}
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-one-oscuro/30" />
              <input
                value={query}
                onChange={(e) => buscar(e.target.value)}
                placeholder="Buscar por nombre o apellido..."
                className="w-full rounded-one-sm border border-one-oscuro/15 py-2 pr-3 pl-9 text-sm outline-none focus-visible:border-one-fucsia focus-visible:ring-2 focus-visible:ring-one-fucsia/40"
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
                    className="rounded-one-sm border border-one-oscuro/10 px-4 py-2.5 text-left text-sm transition-colors duration-150 hover:border-one-fucsia/40 hover:bg-one-fucsia/5 disabled:pointer-events-none disabled:opacity-50"
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

            {error && <p className="mt-2 text-sm text-one-rojo">{error}</p>}

            <div className="mt-3 flex flex-wrap gap-2">
              {leadSugerido && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setPaso('sugerencia');
                    setError('');
                  }}
                  className="rounded-full px-4 py-2 text-sm font-bold text-one-oscuro/70 transition-colors duration-150 hover:bg-one-oscuro/5 disabled:pointer-events-none disabled:opacity-50"
                >
                  Volver a la sugerencia
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
          </>
        )}
      </div>
    </div>
  );
}
