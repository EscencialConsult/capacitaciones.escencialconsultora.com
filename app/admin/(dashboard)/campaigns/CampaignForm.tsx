'use client';

import { useMemo, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { CopyLandingPromptButton } from './CopyLandingPromptButton';
import { FormInput, inputClass, labelClass } from '../FormInput';

type VariableSchema = { key: string; label: string; type: 'text' | 'textarea'; description?: string };
type Plantilla = { id: string; name: string; variables_schema: VariableSchema[] | null };
type EmailPlantilla = { id: string; name: string };
type Accion = (
  prevState: { error?: string } | undefined,
  formData: FormData
) => Promise<{ error?: string } | undefined>;

type PasoExistente = {
  step_number: number;
  email_template_id: string;
  offset_days: number;
  subject: string;
  content: string;
};

type ValoresIniciales = {
  slug: string;
  name: string;
  template_id: string;
  advisor_name: string | null;
  whatsapp_number: string | null;
  whatsapp_message: string | null;
  variables: Record<string, string>;
  pasos: PasoExistente[];
};

function BotonGuardar({ texto, textoPendiente }: { texto: string; textoPendiente: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-one-fucsia px-6 py-2.5 text-sm font-bold text-one-negro transition-all duration-300 hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-60"
    >
      {pending ? textoPendiente : texto}
    </button>
  );
}

function BloqueEmail({
  numero,
  obligatorio,
  emailTemplates,
  valores,
}: {
  numero: 1 | 2 | 3 | 4;
  obligatorio: boolean;
  emailTemplates: EmailPlantilla[];
  valores?: PasoExistente;
}) {
  return (
    <section className="rounded-one-lg bg-one-oscuro/5 p-5">
      <h2 className="text-sm font-bold text-one-oscuro">
        Email {numero} {obligatorio ? '(obligatorio)' : '(opcional)'}
      </h2>
      {!obligatorio && (
        <p className="mt-1 text-xs text-one-oscuro/40">
          Dejá asunto y contenido vacíos si no vas a usar este paso — se saltea solo, no hace falta
          escribir nada de relleno.
        </p>
      )}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px]">
        <div>
          <label className={labelClass} htmlFor={`step${numero}_email_template_id`}>
            Diseño de email
          </label>
          <select
            id={`step${numero}_email_template_id`}
            name={`step${numero}_email_template_id`}
            required={obligatorio}
            defaultValue={valores?.email_template_id ?? ''}
            className={inputClass}
          >
            <option value="">{obligatorio ? 'Elegí un diseño' : '— No usar este paso —'}</option>
            {emailTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <FormInput
          id={`step${numero}_offset_days`}
          name={`step${numero}_offset_days`}
          label="Días después del ingreso"
          type="number"
          min={0}
          defaultValue={valores?.offset_days ?? (numero === 1 ? 0 : '')}
          placeholder="0"
        />
      </div>
      <div className="mt-4">
        <FormInput
          id={`step${numero}_subject`}
          name={`step${numero}_subject`}
          label="Asunto"
          required={obligatorio}
          defaultValue={valores?.subject}
        />
      </div>
      <div className="mt-4">
        <label className={labelClass} htmlFor={`step${numero}_content`}>
          Contenido
        </label>
        <textarea
          id={`step${numero}_content`}
          name={`step${numero}_content`}
          rows={3}
          required={obligatorio}
          defaultValue={valores?.content}
          className={inputClass}
        />
      </div>
    </section>
  );
}

// Formulario único de "campaña" (borrador, todavía sin link público) —
// sirve para crear y editar: en modo edición se le pasa `valoresIniciales`
// con la landing + sus pasos ya cargados. El campo "Estado" no existe acá
// a propósito: toda campaña nueva arranca en borrador siempre, y pasar a
// "landing activa" es una acción aparte (botón "Activar" en la lista de
// Campañas), no un valor más de este form — ver campaigns/actions.ts.
export function CampaignForm({
  templates,
  emailTemplates,
  action,
  botonTexto,
  botonTextoPendiente,
  valoresIniciales,
}: {
  templates: Plantilla[];
  emailTemplates: EmailPlantilla[];
  action: Accion;
  botonTexto: string;
  botonTextoPendiente: string;
  valoresIniciales?: ValoresIniciales;
}) {
  const [state, formAction] = useFormState(action, undefined);
  const pasoPorNumero = (n: number) => valoresIniciales?.pasos.find((p) => p.step_number === n);

  // La plantilla elegida decide qué campos de variables se muestran acá
  // abajo — cada plantilla declara las suyas sola (ver
  // extraerVariablesDeHtml), así que este form no tiene ninguna lista
  // fija de variables hardcodeada.
  const [templateId, setTemplateId] = useState(valoresIniciales?.template_id ?? templates[0]?.id ?? '');
  const variablesDeLaPlantilla = useMemo(
    () => templates.find((t) => t.id === templateId)?.variables_schema ?? [],
    [templates, templateId]
  );

  // Completar a mano campo por campo no es viable en plantillas ricas
  // (hero + beneficios + planes + FAQ pueden ser 40-60 variables). Este
  // cuadro toma el bloque JSON que devuelve el prompt (ver
  // armarPromptCampanaNueva) y pisa el valor de cada <input>/<textarea>
  // por su id `var_<clave>` directo en el DOM — son campos no
  // controlados, así que esto no pelea con React, y lo que quede
  // cargado ahí es lo que se manda al enviar el formulario igual.
  const [jsonPegado, setJsonPegado] = useState('');
  const [mensajeJson, setMensajeJson] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  function aplicarJson() {
    let valores: unknown;
    try {
      valores = JSON.parse(jsonPegado);
    } catch {
      setMensajeJson({ tipo: 'error', texto: 'Ese texto no es JSON válido — revisá que empiece con { y termine con }.' });
      return;
    }
    if (typeof valores !== 'object' || valores === null || Array.isArray(valores)) {
      setMensajeJson({ tipo: 'error', texto: 'Tiene que ser un objeto {"clave": "valor"}, no una lista ni un texto suelto.' });
      return;
    }
    let completados = 0;
    for (const v of variablesDeLaPlantilla) {
      const valor = (valores as Record<string, unknown>)[v.key];
      if (valor === undefined) continue;
      const el = document.getElementById(`var_${v.key}`) as HTMLInputElement | HTMLTextAreaElement | null;
      if (el) {
        el.value = String(valor);
        completados++;
      }
    }
    setMensajeJson(
      completados > 0
        ? { tipo: 'ok', texto: `Completé ${completados} de ${variablesDeLaPlantilla.length} campos. Revisalos antes de guardar.` }
        : { tipo: 'error', texto: 'No encontré ninguna clave que coincida con los campos de esta plantilla.' }
    );
  }

  return (
    <form action={formAction} className="mt-6 space-y-6">
      <section className="rounded-one-lg bg-one-oscuro/5 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-one-oscuro">Datos generales</h2>
          <CopyLandingPromptButton variables={variablesDeLaPlantilla} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormInput
            id="slug"
            name="slug"
            label="Link (slug)"
            placeholder="liquidacion-ago26"
            required
            defaultValue={valoresIniciales?.slug}
            hint="Va a quedar en capacitaciones.escencialconsultora.com/liquidacion-ago26 — recién existe de verdad cuando actives la campaña."
          />
          <FormInput
            id="name"
            name="name"
            label="Nombre interno"
            placeholder="Liquidación Agosto 2026"
            required
            defaultValue={valoresIniciales?.name}
          />

          <div>
            <label className={labelClass} htmlFor="template_id">
              Plantilla de landing (diseño)
            </label>
            <select
              id="template_id"
              name="template_id"
              required
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className={inputClass}
            >
              {!templateId && <option value="">Elegí un diseño</option>}
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {variablesDeLaPlantilla.length > 0 && (
          <div className="mt-4 rounded-one-sm border border-dashed border-one-fucsia/30 bg-one-fucsia/5 p-4">
            <label className={labelClass} htmlFor="json_variables">
              Pegar JSON generado por la IA (opcional, completa los campos de abajo solo)
            </label>
            <textarea
              id="json_variables"
              rows={3}
              value={jsonPegado}
              onChange={(e) => setJsonPegado(e.target.value)}
              placeholder={'{\n  "titulo": "...",\n  "precio_plan_1": "..."\n}'}
              className={`${inputClass} font-mono text-xs`}
            />
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={aplicarJson}
                className="rounded-full bg-one-fucsia px-4 py-1.5 text-xs font-bold text-one-negro transition-all duration-300 hover:-translate-y-0.5"
              >
                Completar campos
              </button>
              {mensajeJson && (
                <span className={`text-xs ${mensajeJson.tipo === 'ok' ? 'text-emerald-600' : 'text-one-rojo'}`}>
                  {mensajeJson.texto}
                </span>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {variablesDeLaPlantilla.length === 0 && (
            <p className="text-xs text-one-oscuro/40 sm:col-span-2">
              {templateId
                ? 'Esta plantilla no tiene ningún {{clave}} en su HTML — no hay texto editable por campaña.'
                : 'Elegí una plantilla arriba para ver qué campos de texto tiene.'}
            </p>
          )}
          {variablesDeLaPlantilla.map((v) =>
            v.type === 'textarea' ? (
              <div key={v.key} className="sm:col-span-2">
                <label className={labelClass} htmlFor={`var_${v.key}`}>
                  {v.label}
                </label>
                <textarea
                  id={`var_${v.key}`}
                  name={`var_${v.key}`}
                  rows={3}
                  defaultValue={valoresIniciales?.variables[v.key]}
                  className={inputClass}
                />
              </div>
            ) : (
              <FormInput
                key={v.key}
                id={`var_${v.key}`}
                name={`var_${v.key}`}
                label={v.label}
                defaultValue={valoresIniciales?.variables[v.key]}
              />
            )
          )}
        </div>
      </section>

      <section className="rounded-one-lg bg-one-oscuro/5 p-5">
        <h2 className="text-sm font-bold text-one-oscuro">Asesora y WhatsApp</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormInput
            id="advisor_name"
            name="advisor_name"
            label="Nombre de la asesora"
            defaultValue={valoresIniciales?.advisor_name ?? undefined}
          />
          <FormInput
            id="whatsapp_number"
            name="whatsapp_number"
            label="WhatsApp (sin +, ej. 5493815551234)"
            defaultValue={valoresIniciales?.whatsapp_number ?? undefined}
          />
          <div className="sm:col-span-2">
            <FormInput
              id="whatsapp_message"
              name="whatsapp_message"
              label="Mensaje prellenado (lo escribe el LEAD, no el sistema)"
              placeholder="Hola, quiero más info sobre la campaña"
              defaultValue={valoresIniciales?.whatsapp_message ?? undefined}
            />
          </div>
        </div>
      </section>

      <BloqueEmail numero={1} obligatorio emailTemplates={emailTemplates} valores={pasoPorNumero(1)} />
      <BloqueEmail numero={2} obligatorio={false} emailTemplates={emailTemplates} valores={pasoPorNumero(2)} />
      <BloqueEmail numero={3} obligatorio={false} emailTemplates={emailTemplates} valores={pasoPorNumero(3)} />
      <BloqueEmail numero={4} obligatorio={false} emailTemplates={emailTemplates} valores={pasoPorNumero(4)} />

      {state?.error && <p className="text-sm text-one-rojo">{state.error}</p>}

      <BotonGuardar texto={botonTexto} textoPendiente={botonTextoPendiente} />
    </form>
  );
}
