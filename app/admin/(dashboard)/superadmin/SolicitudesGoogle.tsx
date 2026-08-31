'use client';

import { useState, useTransition } from 'react';
import { Check, X, ExternalLink } from 'lucide-react';
import { aprobarConexionGoogle, rechazarConexionGoogle } from './actions';
import { formatFechaHoraAR } from '@/lib/fecha';

// Project id real de Google Cloud (2026-08-31) — hardcodeado a propósito,
// mismo criterio que REDIRECT_URI en lib/google-oauth.ts: si algún día
// se cambia de proyecto, actualizar acá Y ahí. Arma el link directo a
// la pantalla de Test users, para no tener que ir navegando a mano.
const GOOGLE_PROJECT_ID = 'alert-imprint-453001-t5';
const LINK_TEST_USERS = `https://console.cloud.google.com/auth/audience?project=${GOOGLE_PROJECT_ID}`;

type Solicitud = { userId: string; email: string; nombre: string | null; solicitadoEn: string };

/**
 * Pedidos de conexión de Google pendientes (2026-08-31, pedido
 * explícito) — el paso real de agregar el email como Test user en
 * Google Cloud NO se automatiza (no hay API de Google para eso), así
 * que esto es una cola de trabajo manual con un link directo, no un
 * botón que "hace todo solo". Aprobar acá SOLO registra la decisión —
 * hacerlo sin haber agregado el email en Google Cloud primero deja al
 * admin viendo el mismo error 403 de siempre al intentar conectar.
 */
export function SolicitudesGoogle({ solicitudes }: { solicitudes: Solicitud[] }) {
  const [pendiente, startTransition] = useTransition();
  const [procesando, setProcesando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (solicitudes.length === 0) {
    return <p className="mt-4 text-sm text-one-oscuro/40">No hay pedidos de conexión pendientes.</p>;
  }

  const resolver = (userId: string, accion: 'aprobar' | 'rechazar') => {
    setError(null);
    setProcesando(userId);
    startTransition(async () => {
      const r = accion === 'aprobar' ? await aprobarConexionGoogle(userId) : await rechazarConexionGoogle(userId);
      if (r?.error) setError(r.error);
      setProcesando(null);
    });
  };

  return (
    <div className="mt-4 space-y-2">
      {solicitudes.map((s) => (
        <div
          key={s.userId}
          className="flex flex-wrap items-center justify-between gap-3 rounded-one-sm bg-one-oscuro/5 px-4 py-3"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-one-oscuro">{s.nombre || s.email}</p>
            <p className="text-xs text-one-oscuro/50">
              {s.email} · pidió acceso el {formatFechaHoraAR(s.solicitadoEn)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={LINK_TEST_USERS}
              target="_blank"
              rel="noreferrer"
              title="1) Agregá este email como Test user acá antes de aprobar"
              className="inline-flex items-center gap-1.5 rounded-full border border-one-oscuro/15 px-3 py-1.5 text-xs font-bold text-one-oscuro transition-colors duration-150 hover:bg-one-oscuro/10"
            >
              <ExternalLink className="size-3.5" strokeWidth={2} />
              Agregar en Google Cloud
            </a>
            <button
              type="button"
              disabled={pendiente && procesando === s.userId}
              onClick={() => resolver(s.userId, 'rechazar')}
              title="Rechazar"
              className="inline-flex items-center justify-center rounded-full border border-one-rojo/30 p-1.5 text-one-rojo transition-colors duration-150 hover:bg-one-rojo/10 disabled:pointer-events-none disabled:opacity-50"
            >
              <X className="size-4" strokeWidth={2.5} />
            </button>
            <button
              type="button"
              disabled={pendiente && procesando === s.userId}
              onClick={() => resolver(s.userId, 'aprobar')}
              title="Ya agregué el email en Google Cloud — aprobar"
              className="inline-flex items-center gap-1.5 rounded-full bg-one-fucsia px-3 py-1.5 text-xs font-bold text-one-negro transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-one-fucsia disabled:pointer-events-none disabled:opacity-60"
            >
              <Check className="size-3.5" strokeWidth={2.5} />
              Aprobar
            </button>
          </div>
        </div>
      ))}
      {error && <p className="text-xs font-medium text-one-rojo">{error}</p>}
    </div>
  );
}
