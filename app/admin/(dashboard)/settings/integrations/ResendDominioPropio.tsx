'use client';

import { useState, useTransition } from 'react';
import { Globe, RefreshCw, CheckCircle2, TriangleAlert } from 'lucide-react';
import { inputClass, labelClass } from '../../FormInput';
import { crearDominioPropioResend, verificarDominioPropioResend } from './actions';

/**
 * Dominio de envío propio, verificado sin salir del panel (2026-08-31,
 * pedido explícito) — reemplaza "andá a Hostinger y cargá esto a mano".
 * Ver lib/dominio-resend.ts para la orquestación real. Solo se muestra
 * si ya se conectó una API key de Resend (sin eso no hay con qué crear
 * nada) y todavía no hay un sender_email cargado (si ya lo hay —
 * conectado antes de este cambio, o cargado a mano por alguien que ya
 * tenía un dominio propio — no hace falta este paso).
 */
export function ResendDominioPropio({
  dominioNombre,
  dominioEstado,
  dominioError,
  senderEmail,
}: {
  dominioNombre: string | null;
  dominioEstado: 'pendiente' | 'verificado' | 'error' | null;
  dominioError: string | null;
  senderEmail: string | null;
}) {
  const [subdominio, setSubdominio] = useState('');
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(dominioError);

  if (senderEmail && dominioEstado === 'verificado') {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-one-sm bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
        <CheckCircle2 className="size-4 shrink-0" strokeWidth={2} />
        Dominio propio verificado — mandás desde {senderEmail}.
      </div>
    );
  }

  // Alguien conectó Resend antes de este cambio y ya tiene un remitente
  // cargado a mano (de un dominio que verificó él mismo, fuera de este
  // flujo) — no hace falta ofrecerle crear uno nuevo.
  if (senderEmail && !dominioEstado) {
    return null;
  }

  const crear = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const r = await crearDominioPropioResend(formData);
      if (r?.error) setError(r.error);
    });
  };

  const verificar = () => {
    setError(null);
    startTransition(async () => {
      const r = await verificarDominioPropioResend();
      if (r?.error) setError(r.error);
    });
  };

  return (
    <div className="mt-4 rounded-one-sm bg-one-oscuro/5 p-4">
      <div className="flex items-center gap-1.5 text-sm font-bold text-one-oscuro">
        <Globe className="size-4" strokeWidth={1.75} />
        Dominio de envío propio
      </div>
      <p className="mt-1 text-xs text-one-oscuro/60">
        Resend exige un dominio verificado para poder mandar — creá el tuyo acá, sin tocar nada
        de Hostinger ni de tu cuenta de Resend a mano. Queda como{' '}
        <code className="rounded-one-sm bg-one-oscuro/10 px-1">nombre.escencialconsultora.com</code>.
      </p>

      {!dominioNombre ? (
        <form
          action={crear}
          className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label className={labelClass} htmlFor="subdominio">
              Nombre de tu subdominio
            </label>
            <div className="flex items-center gap-1.5">
              <input
                id="subdominio"
                name="subdominio"
                value={subdominio}
                onChange={(e) => setSubdominio(e.target.value.toLowerCase())}
                placeholder="mariana"
                className={inputClass}
              />
              <span className="text-xs whitespace-nowrap text-one-oscuro/40">.escencialconsultora.com</span>
            </div>
          </div>
          <button
            type="submit"
            disabled={pendiente || !subdominio}
            className="inline-flex items-center gap-1.5 rounded-full bg-one-fucsia px-4 py-2 text-xs font-bold text-one-negro transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-one-fucsia disabled:pointer-events-none disabled:opacity-60"
          >
            {pendiente ? 'Creando...' : 'Crear subdominio'}
          </button>
        </form>
      ) : (
        <div className="mt-3">
          <p className="text-xs text-one-oscuro/70">
            Subdominio: <span className="font-semibold text-one-oscuro">{dominioNombre}</span>
            {dominioEstado === 'pendiente' && (
              <span className="ml-2 rounded-full bg-one-dorado/15 px-2 py-0.5 text-[11px] font-semibold text-one-dorado">
                verificando...
              </span>
            )}
            {dominioEstado === 'error' && (
              <span className="ml-2 rounded-full bg-one-rojo/10 px-2 py-0.5 text-[11px] font-semibold text-one-rojo">
                con error
              </span>
            )}
          </p>
          <button
            type="button"
            onClick={verificar}
            disabled={pendiente}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-one-oscuro/15 px-4 py-1.5 text-xs font-bold text-one-oscuro transition-colors duration-150 ease-out hover:bg-one-oscuro/10 disabled:pointer-events-none disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${pendiente ? 'animate-spin' : ''}`} strokeWidth={2} />
            {pendiente ? 'Verificando...' : 'Verificar ahora'}
          </button>
        </div>
      )}

      {error && (
        <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-one-rojo">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
          {error}
        </p>
      )}
    </div>
  );
}
