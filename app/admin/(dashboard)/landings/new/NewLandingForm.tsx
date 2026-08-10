'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createLanding } from '../actions';
import { CopyLandingPromptButton } from './CopyLandingPromptButton';

type Plantilla = { id: string; name: string };
type EmailPlantilla = { id: string; name: string };

function BotonCrear() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-azul px-4 py-2 text-sm font-semibold text-white hover:bg-azul-oscuro disabled:opacity-60"
    >
      {pending ? 'Creando...' : 'Crear landing'}
    </button>
  );
}

const campo =
  'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-azul focus:outline-none';
const etiqueta = 'block text-sm font-medium text-slate-700';

function BloqueEmail({
  numero,
  obligatorio,
  emailTemplates,
}: {
  numero: 1 | 2 | 3 | 4;
  obligatorio: boolean;
  emailTemplates: EmailPlantilla[];
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-800">
        Email {numero} {obligatorio ? '(obligatorio)' : '(opcional)'}
      </h2>
      {!obligatorio && (
        <p className="mt-1 text-xs text-slate-400">
          Dejá asunto y contenido vacíos si no vas a usar este paso — se saltea solo, no hace falta
          escribir nada de relleno.
        </p>
      )}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px]">
        <div>
          <label className={etiqueta} htmlFor={`step${numero}_email_template_id`}>
            Diseño de email
          </label>
          <select
            id={`step${numero}_email_template_id`}
            name={`step${numero}_email_template_id`}
            required={obligatorio}
            defaultValue=""
            className={campo}
          >
            <option value="">{obligatorio ? 'Elegí un diseño' : '— No usar este paso —'}</option>
            {emailTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={etiqueta} htmlFor={`step${numero}_offset_days`}>
            Días después del ingreso
          </label>
          <input
            id={`step${numero}_offset_days`}
            name={`step${numero}_offset_days`}
            type="number"
            min={0}
            defaultValue={numero === 1 ? 0 : ''}
            placeholder="0"
            className={campo}
          />
        </div>
      </div>
      <div className="mt-4">
        <label className={etiqueta} htmlFor={`step${numero}_subject`}>
          Asunto
        </label>
        <input
          id={`step${numero}_subject`}
          name={`step${numero}_subject`}
          required={obligatorio}
          className={campo}
        />
      </div>
      <div className="mt-4">
        <label className={etiqueta} htmlFor={`step${numero}_content`}>
          Contenido
        </label>
        <textarea
          id={`step${numero}_content`}
          name={`step${numero}_content`}
          rows={3}
          required={obligatorio}
          className={campo}
        />
      </div>
    </section>
  );
}

export function NewLandingForm({
  templates,
  emailTemplates,
}: {
  templates: Plantilla[];
  emailTemplates: EmailPlantilla[];
}) {
  const [state, formAction] = useFormState(createLanding, undefined);

  return (
    <form action={formAction} className="mt-6 space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Datos generales</h2>
          <CopyLandingPromptButton />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={etiqueta} htmlFor="slug">
              Link (slug)
            </label>
            <input id="slug" name="slug" placeholder="liquidacion-ago26" required className={campo} />
            <p className="mt-1 text-xs text-slate-400">
              Va a quedar en capacitaciones.escencialconsultora.com/liquidacion-ago26
            </p>
          </div>
          <div>
            <label className={etiqueta} htmlFor="name">
              Nombre interno
            </label>
            <input id="name" name="name" placeholder="Liquidación Agosto 2026" required className={campo} />
          </div>

          <div>
            <label className={etiqueta} htmlFor="template_id">
              Plantilla de landing
            </label>
            <select id="template_id" name="template_id" required className={campo}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={etiqueta} htmlFor="status">
              Estado
            </label>
            <select id="status" name="status" defaultValue="draft" className={campo}>
              <option value="draft">Borrador (no visible)</option>
              <option value="active">Activa</option>
            </select>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={etiqueta} htmlFor="var_titulo">
              Título principal
            </label>
            <input id="var_titulo" name="var_titulo" className={campo} />
          </div>
          <div>
            <label className={etiqueta} htmlFor="var_subtitulo">
              Subtítulo
            </label>
            <input id="var_subtitulo" name="var_subtitulo" className={campo} />
          </div>
          <div>
            <label className={etiqueta} htmlFor="var_boton_texto">
              Texto del botón
            </label>
            <input id="var_boton_texto" name="var_boton_texto" defaultValue="Enviar" className={campo} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-800">Asesora y WhatsApp</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={etiqueta} htmlFor="advisor_name">
              Nombre de la asesora
            </label>
            <input id="advisor_name" name="advisor_name" className={campo} />
          </div>
          <div>
            <label className={etiqueta} htmlFor="whatsapp_number">
              WhatsApp (sin +, ej. 5493815551234)
            </label>
            <input id="whatsapp_number" name="whatsapp_number" className={campo} />
          </div>
          <div className="sm:col-span-2">
            <label className={etiqueta} htmlFor="whatsapp_message">
              Mensaje prellenado (lo escribe el LEAD, no el sistema)
            </label>
            <input
              id="whatsapp_message"
              name="whatsapp_message"
              placeholder="Hola, quiero más info sobre la campaña"
              className={campo}
            />
          </div>
        </div>
      </section>

      <BloqueEmail numero={1} obligatorio emailTemplates={emailTemplates} />
      <BloqueEmail numero={2} obligatorio={false} emailTemplates={emailTemplates} />
      <BloqueEmail numero={3} obligatorio={false} emailTemplates={emailTemplates} />
      <BloqueEmail numero={4} obligatorio={false} emailTemplates={emailTemplates} />

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <BotonCrear />
    </form>
  );
}
