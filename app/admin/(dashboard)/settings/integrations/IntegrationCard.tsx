'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { CheckCircle2, CircleOff, ChevronDown, KeyRound, Unplug, CreditCard } from 'lucide-react';
import { inputClass, labelClass } from '../../FormInput';
import { iconActionClass, IconActionGlyph } from '../../IconAction';

type EstadoAccion = { error?: string; ok?: true };
type AccionConectar = (prevState: EstadoAccion | undefined, formData: FormData) => Promise<EstadoAccion>;

/**
 * Plan pago — stub a propósito (2026-08-26, pedido explícito: "armá la
 * opción así me acuerdo de implementarlo a futuro"). No hay pasarela de
 * pago ni facturación real acá — es un toggle + un número a mano. Lo
 * que SÍ es real: guardar esto cambia de verdad cuántos créditos
 * mensuales tiene la cuenta (ver creditos_mensuales_de en la migración
 * 0019) — el día que haya un plan pago de verdad, no hace falta tocar
 * código, alcanza con que este número refleje lo que el proveedor da.
 */
function PlanPagoStub({
  planTipo,
  creditosPago,
  creditosFreeCalculados,
  onDeclarar,
}: {
  planTipo: 'free' | 'pago';
  creditosPago?: number | null;
  creditosFreeCalculados: number;
  onDeclarar: (formData: FormData) => Promise<EstadoAccion>;
}) {
  const [esPago, setEsPago] = useState(planTipo === 'pago');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  return (
    <form
      action={async (formData) => {
        setError(null);
        setGuardando(true);
        try {
          const r = await onDeclarar(formData);
          if (r?.error) setError(r.error);
          else setGuardado(true);
        } finally {
          setGuardando(false);
        }
      }}
      className="mt-4 rounded-one-sm bg-one-oscuro/5 p-4"
    >
      <label className="flex items-center gap-2 text-sm font-semibold text-one-oscuro">
        <input
          type="checkbox"
          name="plan_tipo_checkbox"
          checked={esPago}
          onChange={(e) => {
            setEsPago(e.target.checked);
            setGuardado(false);
          }}
          className="size-4 rounded border-one-oscuro/30 accent-one-fucsia focus:ring-2 focus:ring-one-fucsia/20"
        />
        Esta es una cuenta con plan pago
      </label>
      <input type="hidden" name="plan_tipo" value={esPago ? 'pago' : 'free'} />
      <p className="mt-1 text-xs text-one-oscuro/40">
        {esPago
          ? 'Declará cuántos créditos mensuales tiene el plan pago — reemplaza el cálculo automático del plan gratuito.'
          : `Plan gratuito: se calculan ${creditosFreeCalculados.toLocaleString('es-AR')} créditos/mes automáticamente, sin nada que declarar acá.`}
      </p>
      {esPago && (
        <div className="mt-3 max-w-xs">
          <label className={labelClass} htmlFor="creditos_pago">
            Créditos mensuales del plan pago
          </label>
          <input
            id="creditos_pago"
            name="creditos_pago"
            type="number"
            min={0}
            step={1}
            defaultValue={creditosPago ?? undefined}
            placeholder="ej. 50000"
            className={inputClass}
          />
        </div>
      )}
      {error && <p className="mt-2 text-xs font-medium text-one-rojo">{error}</p>}
      {guardado && !error && <p className="mt-2 text-xs font-medium text-emerald-600">Guardado.</p>}
      <button
        type="submit"
        disabled={guardando}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-one-oscuro/15 px-4 py-1.5 text-xs font-bold text-one-oscuro transition-colors duration-150 ease-out hover:bg-one-oscuro/10 disabled:pointer-events-none disabled:opacity-50"
      >
        <CreditCard className="size-3.5" strokeWidth={1.75} />
        {guardando ? 'Guardando...' : 'Guardar plan'}
      </button>
    </form>
  );
}

function BotonConectar({ texto }: { texto: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-one-fucsia px-6 py-2.5 text-sm font-bold text-one-negro transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-one-fucsia disabled:pointer-events-none disabled:opacity-60"
    >
      {pending ? 'Validando...' : texto}
    </button>
  );
}

/**
 * Tarjeta de proveedor del panel de Integraciones — una por proveedor
 * (Brevo, Resend). El formulario de conexión pasa SIEMPRE por
 * useFormState llamando a la Server Action `onConectar`, que valida
 * formato + hace una llamada real al proveedor ANTES de guardar nada
 * (ver actions.ts) — acá del lado del cliente solo se replica el chequeo
 * de formato (feedback inmediato, sin esperar al servidor), nunca se
 * confía en eso como única validación.
 */
export function IntegrationCard({
  proveedor,
  colorAcento,
  prefijoEsperado,
  conectado,
  apiKeyLast4,
  validatedAt,
  onConectar,
  onDesconectar,
  camposExtra,
  instrucciones,
  planTipo,
  creditosPago,
  creditosFreeCalculados,
  onDeclararPlan,
}: {
  proveedor: string;
  colorAcento: 'rojo' | 'azul';
  prefijoEsperado: string;
  conectado: boolean;
  apiKeyLast4?: string | null;
  validatedAt?: string | null;
  onConectar: AccionConectar;
  onDesconectar: () => Promise<EstadoAccion>;
  /** Campos extra que solo hacen falta en la primera conexión (ej. remitente de Brevo). */
  camposExtra?: ReactNode;
  instrucciones: ReactNode;
  planTipo: 'free' | 'pago';
  creditosPago?: number | null;
  creditosFreeCalculados: number;
  onDeclararPlan: (formData: FormData) => Promise<EstadoAccion>;
}) {
  const [state, formAction] = useFormState(onConectar, undefined);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [valorPegado, setValorPegado] = useState('');
  const [desconectando, setDesconectando] = useState(false);
  const [errorDesconectar, setErrorDesconectar] = useState<string | null>(null);
  const [mostrarExito, setMostrarExito] = useState(false);

  // Cuando la Server Action confirma que guardó (state.ok), cerramos el
  // formulario y borramos la clave del input — si no, se quedaba abierto
  // con la clave recién pegada visible y sin ningún cartel de éxito, y el
  // admin no tenía forma de saber si el submit surtió efecto sin fijarse
  // en el last4 de la tarjeta de arriba. `state` solo cambia de
  // referencia cuando se ejecuta formAction (no al reabrir el form a
  // mano), así que este efecto no se re-dispara solo.
  useEffect(() => {
    if (state?.ok) {
      setMostrarForm(false);
      setValorPegado('');
      setMostrarExito(true);
    }
  }, [state]);

  const formatoSospechoso = valorPegado.length > 0 && !valorPegado.startsWith(prefijoEsperado);
  // Clases completas y literales a propósito (no `bg-${acento}` armado en
  // runtime) — Tailwind arma su CSS final escaneando el código fuente
  // como texto en build time, no ejecutando JS: una clase interpolada a
  // partir de una variable nunca aparece en el CSS generado y el botón
  // queda sin fondo.
  const claseBotonConectar =
    colorAcento === 'rojo'
      ? 'bg-one-rojo hover:-translate-y-0.5 hover:shadow-one-md'
      : 'bg-one-fucsia hover:-translate-y-0.5 hover:shadow-one-fucsia';

  return (
    <div className="rounded-one-lg border border-one-oscuro/10 bg-one-blanco p-6 shadow-one-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-one-oscuro">{proveedor}</h2>
          {conectado ? (
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">
              <CheckCircle2 className="size-3.5" /> Conectado
            </span>
          ) : (
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-one-oscuro/5 px-2.5 py-1 text-xs font-semibold text-one-oscuro/50">
              <CircleOff className="size-3.5" /> Desconectado
            </span>
          )}
        </div>
      </div>

      {conectado ? (
        <div className="mt-5">
          <p className="text-sm text-one-oscuro/70">
            Clave activa: <code className="rounded-one-sm bg-one-oscuro/5 px-1.5 py-0.5 text-xs">{prefijoEsperado}••••••••{apiKeyLast4}</code>
          </p>
          {validatedAt && (
            <p className="mt-1 text-xs text-one-oscuro/40">
              Validada el {new Date(validatedAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}.
            </p>
          )}
          {errorDesconectar && <p className="mt-2 text-xs font-medium text-one-rojo">{errorDesconectar}</p>}
          {mostrarExito && !mostrarForm && (
            <p className="mt-2 text-xs font-medium text-emerald-600">Clave guardada y validada correctamente.</p>
          )}
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              title="Actualizar clave"
              aria-label={`Actualizar clave de ${proveedor}`}
              onClick={() => {
                setMostrarForm((v) => !v);
                setMostrarExito(false);
              }}
              className={iconActionClass()}
            >
              <IconActionGlyph icon={KeyRound} />
            </button>
            <button
              type="button"
              title="Desconectar"
              aria-label={`Desconectar ${proveedor}`}
              disabled={desconectando}
              onClick={async () => {
                if (!confirm(`¿Desconectar ${proveedor}? Los envíos que dependan de esta clave van a dejar de funcionar hasta que conectes otra.`)) return;
                setErrorDesconectar(null);
                setDesconectando(true);
                try {
                  const r = await onDesconectar();
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
            onDeclarar={onDeclararPlan}
          />
        </div>
      ) : (
        <div className="mt-5">
          {!mostrarForm && (
            <button
              type="button"
              onClick={() => setMostrarForm(true)}
              className={`rounded-full px-6 py-2.5 text-sm font-bold text-one-blanco transition-[transform,box-shadow] duration-200 ease-out ${claseBotonConectar}`}
            >
              Conectar cuenta
            </button>
          )}
        </div>
      )}

      {mostrarForm && (
        <form action={formAction} className="mt-5 space-y-4 border-t border-one-oscuro/10 pt-5">
          <div>
            <label className={labelClass} htmlFor={`api_key_${proveedor}`}>
              API Key de {proveedor}
            </label>
            <input
              id={`api_key_${proveedor}`}
              name="api_key"
              // Mismo criterio que el login y el alta de usuario: la clave
              // no queda legible en pantalla mientras se pega/edita (evita
              // exponerla en capturas, grabaciones de pantalla o pantalla
              // compartida) — acá pesa más todavía porque es una key real
              // de envío de la cuenta de mail, no una contraseña propia.
              type="password"
              autoComplete="off"
              spellCheck={false}
              required
              value={valorPegado}
              onChange={(e) => setValorPegado(e.target.value)}
              placeholder={`${prefijoEsperado}...`}
              className={inputClass}
            />
            {formatoSospechoso && (
              <p className="mt-1 text-xs font-medium text-one-rojo">
                El formato de la clave no es correcto — tiene que empezar con &quot;{prefijoEsperado}&quot;. Revisá las instrucciones de abajo.
              </p>
            )}
          </div>

          {!conectado && camposExtra}

          {state?.error && <p className="text-sm font-medium text-one-rojo">{state.error}</p>}

          <div className="flex items-center gap-3">
            <BotonConectar texto={conectado ? 'Actualizar clave' : 'Guardar y validar'} />
            <button
              type="button"
              onClick={() => setMostrarForm(false)}
              className="text-sm font-semibold text-one-oscuro/50 transition-colors duration-150 hover:text-one-oscuro"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <details className="group mt-5 rounded-one-sm bg-one-oscuro/5 open:pb-4">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-one-oscuro">
          ¿Cómo obtengo mi API Key de {proveedor}?
          <ChevronDown className="size-4 text-one-oscuro/40 transition-transform duration-200 group-open:rotate-180" />
        </summary>
        <div className="space-y-2 px-4 text-sm text-one-oscuro/70">{instrucciones}</div>
      </details>
    </div>
  );
}
