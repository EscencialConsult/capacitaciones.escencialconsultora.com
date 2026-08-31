'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { CheckCircle2, Unplug } from 'lucide-react';
import { FormInput } from '../FormInput';
import { guardarConfigGoogle, borrarConfigGoogle } from './actions';
import { iconActionClass, IconActionGlyph } from '../IconAction';

function BotonGuardar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-one-fucsia px-6 py-2.5 text-sm font-bold text-one-negro transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-one-fucsia disabled:pointer-events-none disabled:opacity-60"
    >
      {pending ? 'Guardando...' : 'Guardar configuración'}
    </button>
  );
}

/**
 * Formulario real (no "pegalo en el chat") porque esta pantalla ya está
 * gateada por esSuperAdmin — a diferencia del token de Hostinger/Netlify
 * (que solo vive en variables de entorno, sin ninguna pantalla propia
 * todavía), esto tiene sentido guardarlo cifrado en la base como el
 * resto de los secretos de este panel (mismo lib/crypto.ts que las API
 * keys de Brevo/Resend).
 */
export function ConfigGoogleForm({
  yaConfigurado,
  clientId,
  configuradoEn,
}: {
  yaConfigurado: boolean;
  clientId: string | null;
  configuradoEn: string | null;
}) {
  const [state, formAction] = useFormState(guardarConfigGoogle, undefined);
  const [desconectando, setDesconectando] = useState(false);
  const [errorDesconectar, setErrorDesconectar] = useState<string | null>(null);

  if (yaConfigurado && !state?.ok) {
    return (
      <div className="mt-5">
        <div className="flex items-center gap-2 rounded-one-sm bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <CheckCircle2 className="size-4 shrink-0" strokeWidth={2} />
          Configurado — Client ID <code className="rounded-one-sm bg-emerald-100 px-1 text-xs">{clientId}</code>
        </div>
        {configuradoEn && (
          <p className="mt-1 text-xs text-one-oscuro/40">Desde el {new Date(configuradoEn).toLocaleDateString('es-AR')}.</p>
        )}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            title="Desconectar (borra la config — nadie va a poder conectar Google hasta cargar una nueva)"
            disabled={desconectando}
            onClick={async () => {
              if (!confirm('¿Borrar la configuración de Google? Nadie va a poder conectar su cuenta de Google hasta que cargues una nueva.')) return;
              setErrorDesconectar(null);
              setDesconectando(true);
              try {
                const r = await borrarConfigGoogle();
                if (r?.error) setErrorDesconectar(r.error);
              } finally {
                setDesconectando(false);
              }
            }}
            className={iconActionClass('peligro')}
          >
            <IconActionGlyph icon={Unplug} busy={desconectando} />
          </button>
          <span className="text-xs text-one-oscuro/50">Desconectar</span>
        </div>
        {errorDesconectar && <p className="mt-2 text-xs font-medium text-one-rojo">{errorDesconectar}</p>}
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-5 space-y-4">
      <FormInput id="client_id" name="client_id" label="Client ID" placeholder="xxxxx.apps.googleusercontent.com" required />
      <FormInput id="client_secret" name="client_secret" type="password" autoComplete="off" label="Client Secret" placeholder="GOCSPX-..." required />
      {state?.error && <p className="text-sm font-medium text-one-rojo">{state.error}</p>}
      {state?.ok && <p className="text-sm font-medium text-emerald-600">Guardado.</p>}
      <BotonGuardar />
    </form>
  );
}
