'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { NewCategoryModal } from '../templates/NewCategoryModal';
import { FormInput, inputClass, labelClass } from '../FormInput';

type Categoria = { id: string; name: string };
type Plantilla = { id: string; name: string };
type Accion = (prevState: { error?: string } | undefined, formData: FormData) => Promise<{ error?: string } | undefined>;

function BotonGuardar({ texto }: { texto: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-one-fucsia px-6 py-2.5 text-sm font-bold text-one-negro transition-all duration-300 hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-60"
    >
      {pending ? 'Guardando...' : texto}
    </button>
  );
}

// El link público en sí — slug, nombre, categoría, plantilla, estado.
// Sin contenido propio: eso lo trae la campaña que se conecte después
// (ver campaigns/CampaignForm.tsx). Mismo patrón que TemplateForm.tsx,
// más simple (sin editor de HTML — acá no hay HTML propio).
export function LandingForm({
  action,
  categorias,
  templates,
  botonTexto,
  valoresIniciales,
}: {
  action: Accion;
  categorias: Categoria[];
  templates: Plantilla[];
  botonTexto: string;
  valoresIniciales?: {
    slug: string;
    name: string;
    category_id: string | null;
    template_id: string;
    is_active: boolean;
  };
}) {
  const [state, formAction] = useFormState(action, undefined);
  const [listaCategorias, setListaCategorias] = useState(categorias);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(valoresIniciales?.category_id ?? '');
  const [modalAbierto, setModalAbierto] = useState(false);

  return (
    <form action={formAction} className="mt-6 max-w-xl space-y-4">
      <FormInput
        id="slug"
        name="slug"
        label="Link (slug)"
        placeholder="liquidacion-ago26"
        required
        defaultValue={valoresIniciales?.slug}
        hint="Va a quedar en capacitaciones.escencialconsultora.com/liquidacion-ago26."
      />
      <FormInput
        id="name"
        name="name"
        label="Nombre"
        placeholder="Liquidación Agosto 2026"
        required
        defaultValue={valoresIniciales?.name}
      />

      <div>
        <div className="flex items-center justify-between">
          <label className={labelClass} htmlFor="category_id">
            Categoría
          </label>
          <button
            type="button"
            onClick={() => setModalAbierto(true)}
            className="text-xs text-one-fucsia hover:underline"
          >
            ¿No está la que buscás? Crear categoría nueva
          </button>
        </div>
        <select
          id="category_id"
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

      {modalAbierto && (
        <NewCategoryModal
          onClose={() => setModalAbierto(false)}
          onCreated={(categoria) => {
            setListaCategorias((prev) => [...prev, categoria]);
            setCategoriaSeleccionada(categoria.id);
            setModalAbierto(false);
          }}
        />
      )}

      <div>
        <label className={labelClass} htmlFor="template_id">
          Plantilla
        </label>
        <select
          id="template_id"
          name="template_id"
          required
          defaultValue={valoresIniciales?.template_id ?? ''}
          className={inputClass}
        >
          {!valoresIniciales?.template_id && <option value="">Elegí un diseño</option>}
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

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

      {state?.error && <p className="text-sm text-one-rojo">{state.error}</p>}

      <BotonGuardar texto={botonTexto} />
    </form>
  );
}
