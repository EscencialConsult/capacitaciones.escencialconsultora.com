'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { FormInput, inputClass, labelClass } from '../FormInput';

type Accion = (prevState: { error?: string } | undefined, formData: FormData) => Promise<{ error?: string } | undefined>;

function BotonGuardar({ texto }: { texto: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-one-fucsia px-6 py-2.5 text-sm font-bold text-one-negro transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-one-fucsia disabled:pointer-events-none disabled:opacity-60"
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
  valoresIniciales?: {
    name: string;
    html_content: string;
    is_active: boolean;
    // Para el control de concurrencia optimista de updateEmailTemplate —
    // el valor tal cual vino de la base al abrir el formulario, viaja de
    // vuelta como input hidden para que el servidor pueda detectar si
    // alguien más guardó esta plantilla mientras tanto.
    updated_at?: string;
  };
}) {
  const [state, formAction] = useFormState(action, undefined);
  const [html, setHtml] = useState(valoresIniciales?.html_content ?? '');

  return (
    <form action={formAction} className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Control de concurrencia optimista — ver actions.ts (updateEmailTemplate).
          Solo tiene valor en edición; en "Nueva plantilla" viaja vacío y
          el servidor ni lo mira porque ese flujo no pasa por updateEmailTemplate. */}
      {valoresIniciales?.updated_at && (
        <input type="hidden" name="expected_updated_at" defaultValue={valoresIniciales.updated_at} />
      )}
      <div
        style={{ '--stagger-index': 0 } as React.CSSProperties}
        className="stagger-in space-y-4 rounded-one-lg bg-one-blanco p-6 shadow-one-sm ring-1 ring-one-oscuro/5"
      >
        <FormInput id="name" name="name" label="Nombre" required defaultValue={valoresIniciales?.name} />

        <div>
          <label className={labelClass} htmlFor="is_active">
            Estado
          </label>
          <select
            id="is_active"
            name="is_active"
            defaultValue={String(valoresIniciales?.is_active ?? true)}
            className={inputClass}
          >
            <option value="true">Activa</option>
            <option value="false">Inactiva</option>
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="html_content">
            HTML del email
          </label>
          <textarea
            id="html_content"
            name="html_content"
            required
            rows={18}
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            className={`${inputClass} font-mono text-xs`}
          />
          <p className="mt-1 text-xs text-one-oscuro/40">
            Placeholders fijos: {'{{nombre}}'}, {'{{apellido}}'}, {'{{contenido}}'}, {'{{whatsapp_url}}'},{' '}
            {'{{asesora_nombre}}'}. Usá tablas + estilos inline (no {'<style>'} en el head) para que se vea
            bien en Gmail/Outlook.
          </p>
        </div>

        {state?.error && <p className="text-sm text-one-rojo">{state.error}</p>}

        <BotonGuardar texto={botonTexto} />
      </div>

      <div
        style={{ '--stagger-index': 1 } as React.CSSProperties}
        className="stagger-in rounded-one-lg bg-one-blanco p-6 shadow-one-sm ring-1 ring-one-oscuro/5"
      >
        <p className={labelClass}>Vista previa en vivo</p>
        <div
          className="mt-2 overflow-hidden rounded-one-md border border-one-oscuro/10"
          style={{ height: 600 }}
        >
          <iframe title="Vista previa" srcDoc={html} className="h-full w-full" sandbox="" />
        </div>
      </div>
    </form>
  );
}
