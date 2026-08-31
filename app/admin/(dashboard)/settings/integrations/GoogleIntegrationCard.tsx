'use client';

import { useState } from 'react';
import { Clock, CheckCircle2, Unplug, Mail } from 'lucide-react';
import { iconActionClass, IconActionGlyph } from '../../IconAction';
import { PlanPagoStub } from './IntegrationCard';
import { iniciarConexionGoogle, desconectarGoogle, declararPlanGoogle } from './actions';

/**
 * Google como 3er proveedor de envío (2026-08-31) — a diferencia de
 * Brevo/Resend, acá nunca hay una API key que pegar: el admin conecta
 * con un click y Google se encarga del resto (ver
 * app/admin/(dashboard)/settings/integrations/google/callback/route.ts
 * y lib/google-oauth.ts). El Client ID/Secret de la plataforma vive en
 * /admin/superadmin, gateado por esSuperAdmin — un admin de a pie nunca
 * necesita saber que eso existe.
 */
export function GoogleIntegrationCard({
  configuradoAlgunavez,
  conectado,
  googleEmail,
  tipoCuenta,
  planTipo,
  creditosPago,
}: {
  configuradoAlgunavez: boolean;
  conectado: boolean;
  googleEmail: string | null;
  tipoCuenta: 'personal' | 'workspace' | null;
  planTipo: 'free' | 'pago';
  creditosPago?: number | null;
}) {
  const [desconectando, setDesconectando] = useState(false);
  const [errorDesconectar, setErrorDesconectar] = useState<string | null>(null);

  const creditosFreeCalculados = tipoCuenta === 'workspace' ? 2000 * 30 : 500 * 30;

  return (
    <div className="rounded-one-lg border border-one-oscuro/10 bg-one-blanco p-6 shadow-one-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-one-oscuro">Google</h2>
          {conectado ? (
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">
              <CheckCircle2 className="size-3.5" /> Conectado
            </span>
          ) : configuradoAlgunavez ? (
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-one-oscuro/5 px-2.5 py-1 text-xs font-semibold text-one-oscuro/50">
              <Clock className="size-3.5" /> Desconectado
            </span>
          ) : (
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-one-oscuro/5 px-2.5 py-1 text-xs font-semibold text-one-oscuro/50">
              <Clock className="size-3.5" /> Todavía no disponible
            </span>
          )}
        </div>
      </div>

      {conectado ? (
        <div className="mt-5">
          <p className="text-sm text-one-oscuro/70">
            Mandás desde <code className="rounded-one-sm bg-one-oscuro/5 px-1.5 py-0.5 text-xs">{googleEmail}</code>
            {tipoCuenta && (
              <span className="ml-2 text-xs text-one-oscuro/40">
                ({tipoCuenta === 'workspace' ? 'Google Workspace, 2.000/día' : 'Gmail personal, 500/día'})
              </span>
            )}
          </p>
          {errorDesconectar && <p className="mt-2 text-xs font-medium text-one-rojo">{errorDesconectar}</p>}
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              title="Desconectar"
              aria-label="Desconectar Google"
              disabled={desconectando}
              onClick={async () => {
                if (!confirm('¿Desconectar Google? Los envíos que dependan de esta cuenta van a dejar de funcionar hasta que conectes otra.')) return;
                setErrorDesconectar(null);
                setDesconectando(true);
                try {
                  const r = await desconectarGoogle();
                  if (r?.error) setErrorDesconectar(r.error);
                } finally {
                  setDesconectando(false);
                }
              }}
              className={iconActionClass('peligro')}
            >
              <IconActionGlyph icon={Unplug} busy={desconectando} />
            </button>
          </div>

          <PlanPagoStub
            planTipo={planTipo}
            creditosPago={creditosPago}
            creditosFreeCalculados={creditosFreeCalculados}
            onDeclarar={declararPlanGoogle}
          />
        </div>
      ) : configuradoAlgunavez ? (
        <div className="mt-5">
          <p className="text-sm text-one-oscuro/70">
            Sumá más créditos mandando también desde tu Gmail — 500 destinatarios/día en cuenta
            personal, 2.000/día en Google Workspace. Un solo click, sin pegar ninguna clave.
          </p>
          <form action={iniciarConexionGoogle} className="mt-4">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-one-fucsia px-6 py-2.5 text-sm font-bold text-one-negro transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-one-fucsia"
            >
              <Mail className="size-4" strokeWidth={1.75} />
              Conectar con Google
            </button>
          </form>
        </div>
      ) : (
        <p className="mt-5 text-sm text-one-oscuro/70">
          Todavía no está configurado a nivel plataforma — pedile a un superadmin que lo active
          desde /admin/superadmin.
        </p>
      )}
    </div>
  );
}
