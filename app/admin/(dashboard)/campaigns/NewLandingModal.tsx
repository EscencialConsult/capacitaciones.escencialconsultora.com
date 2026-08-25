'use client';

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createLandingInline } from '../landings/actions';
import { inputClass, labelClass } from '../FormInput';

type VariableSchema = { key: string; label: string; type: 'text' | 'textarea'; description?: string };
type LandingCreada = {
  id: string;
  slug: string;
  name: string;
  template_id: string;
  landing_templates: { name: string; variables_schema: VariableSchema[] | null; envio_personalizado: boolean } | null;
};

function BotonCrear() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-one-fucsia px-6 py-2.5 text-sm font-bold text-one-negro transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-one-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-one-fucsia/40 disabled:pointer-events-none disabled:opacity-60"
    >
      {pending ? 'Creando...' : 'Crear'}
    </button>
  );
}

// Acceso directo a crear una Landing (el link público en sí — slug,
// nombre, plantilla) sin salir del formulario de campaña — mismo
// patrón que NewEmailTemplateModal. La categoría ya no se elige acá:
// es propiedad de la Campaña (ver CampaignForm), no de la Landing.
export function NewLandingModal({
  onClose,
  onCreated,
  templates,
}: {
  onClose: () => void;
  onCreated: (landing: LandingCreada) => void;
  templates: { id: string; name: string; envio_personalizado: boolean }[];
}) {
  const [state, formAction] = useFormState(createLandingInline, undefined);
  const [templateSeleccionado, setTemplateSeleccionado] = useState(templates[0]?.id ?? '');
  // Mismo agrupado que LandingForm.tsx (2026-08-24) — sin esto no había
  // forma de saber, desde este modal chico, si una plantilla era de
  // goteo normal o de envío personalizado.
  const plantillasNormales = templates.filter((t) => !t.envio_personalizado);
  const plantillasPersonalizadas = templates.filter((t) => t.envio_personalizado);

  useEffect(() => {
    if (state?.ok && state.landing) onCreated(state.landing as unknown as LandingCreada);
  }, [state, onCreated]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-one-oscuro/60 p-4 backdrop-blur-sm">
        <div className="stagger-in w-full max-w-md rounded-one-lg bg-one-blanco p-6 shadow-one-lg">
          <h2 className="text-base font-extrabold text-one-oscuro">Nueva landing</h2>
          <p className="mt-1.5 text-xs text-one-oscuro/40">
            El link público en sí — el contenido y la asesora se cargan en la campaña que conectes
            después.
          </p>
          <form action={formAction} className="mt-4 space-y-3">
            <div>
              <label className={labelClass} htmlFor="new_landing_slug">
                Link (slug)
              </label>
              <input
                id="new_landing_slug"
                name="slug"
                autoFocus
                required
                placeholder="liquidacion-ago26"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-one-oscuro/40">
                Va a quedar en capacitaciones.escencialconsultora.com/liquidacion-ago26.
              </p>
            </div>
            <div>
              <label className={labelClass} htmlFor="new_landing_name">
                Nombre
              </label>
              <input
                id="new_landing_name"
                name="name"
                required
                placeholder="Liquidación Agosto 2026"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="new_landing_template_id">
                Plantilla
              </label>
              <select
                id="new_landing_template_id"
                name="template_id"
                required
                value={templateSeleccionado}
                onChange={(e) => setTemplateSeleccionado(e.target.value)}
                className={inputClass}
              >
                {!templateSeleccionado && <option value="">Elegí un diseño</option>}
                {plantillasNormales.length > 0 && (
                  <optgroup label="Plantillas">
                    {plantillasNormales.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {plantillasPersonalizadas.length > 0 && (
                  <optgroup label="Envío personalizado">
                    {plantillasPersonalizadas.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
            {state?.error && <p className="text-sm text-one-rojo">{state.error}</p>}
            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full px-6 py-2.5 text-sm font-bold text-one-oscuro/70 transition-colors duration-200 ease-out hover:bg-one-oscuro/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-one-fucsia/40"
              >
                Cancelar
              </button>
              <BotonCrear />
            </div>
          </form>
        </div>
      </div>
  );
}
