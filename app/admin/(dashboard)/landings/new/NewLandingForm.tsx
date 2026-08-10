'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createLanding } from '../actions';

type Plantilla = { id: string; name: string; variables_schema: unknown };
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
        <h2 className="text-sm font-semibold text-slate-800">Datos generales</h2>

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

        <div className="mt-4">
          <label className={etiqueta} htmlFor="variables_json">
            Variables de la plantilla (JSON)
          </label>
          <textarea
            id="variables_json"
            name="variables_json"
            rows={4}
            defaultValue={'{\n  "titulo": "",\n  "subtitulo": "",\n  "boton_texto": "Enviar"\n}'}
            className={`${campo} font-mono`}
          />
          <p className="mt-1 text-xs text-slate-400">
            Las claves dependen de la plantilla elegida — fijate en la lista de arriba qué placeholders
            usa cada una.
          </p>
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

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-800">Email 1 (obligatorio)</h2>
        <p className="mt-1 text-xs text-slate-400">
          Los pasos 2, 3, 4 se agregan después editando la landing.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4">
          <div>
            <label className={etiqueta} htmlFor="step1_email_template_id">
              Diseño de email
            </label>
            <select id="step1_email_template_id" name="step1_email_template_id" required className={campo}>
              {emailTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={etiqueta} htmlFor="step1_subject">
              Asunto
            </label>
            <input id="step1_subject" name="step1_subject" required className={campo} />
          </div>
          <div>
            <label className={etiqueta} htmlFor="step1_content">
              Contenido
            </label>
            <textarea id="step1_content" name="step1_content" rows={3} required className={campo} />
          </div>
        </div>
      </section>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <BotonCrear />
    </form>
  );
}
