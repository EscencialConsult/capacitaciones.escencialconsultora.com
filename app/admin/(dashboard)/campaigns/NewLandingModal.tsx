'use client';

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createLandingInline } from '../landings/actions';
import { NewCategoryModal } from '../templates/NewCategoryModal';
import { inputClass, labelClass } from '../FormInput';

type VariableSchema = { key: string; label: string; type: 'text' | 'textarea'; description?: string };
type LandingCreada = {
  id: string;
  slug: string;
  name: string;
  template_id: string;
  landing_templates: { name: string; variables_schema: VariableSchema[] | null } | null;
};

function BotonCrear() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-one-fucsia px-6 py-2.5 text-sm font-bold text-one-negro transition-all duration-300 hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-60"
    >
      {pending ? 'Creando...' : 'Crear'}
    </button>
  );
}

// Acceso directo a crear una Landing (el link público en sí — slug,
// nombre, categoría, plantilla) sin salir del formulario de campaña —
// mismo patrón que NewCategoryModal/NewEmailTemplateModal. Reutiliza
// NewCategoryModal tal cual para su propio picker de categoría; ESE
// modal también tiene que quedar afuera del <form> de acá (mismo
// motivo que en CampaignForm: un <form> no puede anidar otro <form>).
export function NewLandingModal({
  onClose,
  onCreated,
  templates,
  categorias,
}: {
  onClose: () => void;
  onCreated: (landing: LandingCreada) => void;
  templates: { id: string; name: string }[];
  categorias: { id: string; name: string }[];
}) {
  const [state, formAction] = useFormState(createLandingInline, undefined);
  const [listaCategorias, setListaCategorias] = useState(categorias);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('');
  const [templateSeleccionado, setTemplateSeleccionado] = useState(templates[0]?.id ?? '');
  const [modalCategoriaAbierto, setModalCategoriaAbierto] = useState(false);

  useEffect(() => {
    if (state?.ok && state.landing) onCreated(state.landing as unknown as LandingCreada);
  }, [state, onCreated]);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-one-oscuro/60 p-4">
        <div className="w-full max-w-md rounded-one-lg bg-one-blanco p-6 shadow-sm">
          <h2 className="text-sm font-bold text-one-oscuro">Nueva landing</h2>
          <p className="mt-1 text-xs text-one-oscuro/40">
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
              <div className="flex items-center justify-between">
                <label className={labelClass} htmlFor="new_landing_category_id">
                  Categoría
                </label>
                <button
                  type="button"
                  onClick={() => setModalCategoriaAbierto(true)}
                  className="text-xs text-one-fucsia hover:underline"
                >
                  Crear categoría nueva
                </button>
              </div>
              <select
                id="new_landing_category_id"
                name="category_id"
                value={categoriaSeleccionada}
                onChange={(e) => setCategoriaSeleccionada(e.target.value)}
                className={inputClass}
              >
                <option value="">— Sin categoría —</option>
                {listaCategorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
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
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            {state?.error && <p className="text-sm text-one-rojo">{state.error}</p>}
            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full px-6 py-2.5 text-sm font-bold text-one-oscuro/70 transition-all duration-300 hover:bg-one-oscuro/5"
              >
                Cancelar
              </button>
              <BotonCrear />
            </div>
          </form>
        </div>
      </div>

      {modalCategoriaAbierto && (
        <NewCategoryModal
          onClose={() => setModalCategoriaAbierto(false)}
          onCreated={(categoria) => {
            setListaCategorias((prev) => [...prev, categoria]);
            setCategoriaSeleccionada(categoria.id);
            setModalCategoriaAbierto(false);
          }}
        />
      )}
    </>
  );
}
