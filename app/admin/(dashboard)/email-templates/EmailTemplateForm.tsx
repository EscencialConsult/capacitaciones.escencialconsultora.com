'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

type Accion = (prevState: { error?: string } | undefined, formData: FormData) => Promise<{ error?: string } | undefined>;

const campo =
  'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-azul focus:outline-none';
const etiqueta = 'block text-sm font-medium text-slate-700';

function BotonGuardar({ texto }: { texto: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-azul px-4 py-2 text-sm font-semibold text-white hover:bg-azul-oscuro disabled:opacity-60"
    >
      {pending ? 'Guardando...' : texto}
    </button>
  );
}

export function EmailTemplateForm({
  action,
  botonTexto,
  valoresIniciales,
}: {
  action: Accion;
  botonTexto: string;
  valoresIniciales?: { name: string; html_content: string; is_active: boolean };
}) {
  const [state, formAction] = useFormState(action, undefined);
  const [html, setHtml] = useState(valoresIniciales?.html_content ?? '');

  return (
    <form action={formAction} className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div>
          <label className={etiqueta} htmlFor="name">
            Nombre
          </label>
          <input id="name" name="name" required defaultValue={valoresIniciales?.name} className={campo} />
        </div>

        <div>
          <label className={etiqueta} htmlFor="is_active">
            Estado
          </label>
          <select
            id="is_active"
            name="is_active"
            defaultValue={String(valoresIniciales?.is_active ?? true)}
            className={campo}
          >
            <option value="true">Activa</option>
            <option value="false">Inactiva</option>
          </select>
        </div>

        <div>
          <label className={etiqueta} htmlFor="html_content">
            HTML del email
          </label>
          <textarea
            id="html_content"
            name="html_content"
            required
            rows={18}
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            className={`${campo} font-mono text-xs`}
          />
          <p className="mt-1 text-xs text-slate-400">
            Placeholders fijos: {'{{nombre}}'}, {'{{apellido}}'}, {'{{contenido}}'}, {'{{whatsapp_url}}'},{' '}
            {'{{asesora_nombre}}'}. Usá tablas + estilos inline (no {'<style>'} en el head) para que se vea
            bien en Gmail/Outlook.
          </p>
        </div>

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

        <BotonGuardar texto={botonTexto} />
      </div>

      <div>
        <p className={etiqueta}>Vista previa en vivo</p>
        <div className="mt-1 overflow-hidden rounded-lg border border-slate-300" style={{ height: 600 }}>
          <iframe title="Vista previa" srcDoc={html} className="h-full w-full" sandbox="" />
        </div>
      </div>
    </form>
  );
}
