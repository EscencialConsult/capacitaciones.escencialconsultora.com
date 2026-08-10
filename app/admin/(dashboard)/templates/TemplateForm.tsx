'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { NewCategoryModal } from './NewCategoryModal';

type Categoria = { id: string; name: string };
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

export function TemplateForm({
  action,
  categorias,
  botonTexto,
  valoresIniciales,
}: {
  action: Accion;
  categorias: Categoria[];
  botonTexto: string;
  valoresIniciales?: {
    name: string;
    category_id: string | null;
    html_content: string;
    variables_schema: unknown;
    is_active: boolean;
  };
}) {
  const [state, formAction] = useFormState(action, undefined);
  const [html, setHtml] = useState(valoresIniciales?.html_content ?? '');
  const [listaCategorias, setListaCategorias] = useState(categorias);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(valoresIniciales?.category_id ?? '');
  const [modalAbierto, setModalAbierto] = useState(false);

  return (
    <form action={formAction} className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div>
          <label className={etiqueta} htmlFor="name">
            Nombre
          </label>
          <input
            id="name"
            name="name"
            required
            defaultValue={valoresIniciales?.name}
            className={campo}
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className={etiqueta} htmlFor="category_id">
              Categoría
            </label>
            <button
              type="button"
              onClick={() => setModalAbierto(true)}
              className="text-xs text-azul hover:underline"
            >
              ¿No está la que buscás? Crear categoría nueva
            </button>
          </div>
          <select
            id="category_id"
            name="category_id"
            value={categoriaSeleccionada}
            onChange={(e) => setCategoriaSeleccionada(e.target.value)}
            className={campo}
          >
            <option value="">— Sin categoría —</option>
            {listaCategorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {listaCategorias.length === 0 && (
            <p className="mt-1 text-xs text-amber-600">
              Todavía no hay ninguna categoría creada — podés dejar esto sin elegir y crear una con el
              botón de arriba.
            </p>
          )}
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
          <label className={etiqueta} htmlFor="variables_schema_json">
            Variables editables (JSON)
          </label>
          <textarea
            id="variables_schema_json"
            name="variables_schema_json"
            rows={4}
            defaultValue={JSON.stringify(valoresIniciales?.variables_schema ?? [], null, 2)}
            className={`${campo} font-mono`}
          />
          <p className="mt-1 text-xs text-slate-400">
            Ej: {'[{"key":"titulo","label":"Título","type":"text"}]'} — estas claves son las que va a
            poder completar quien cree una landing con esta plantilla.
          </p>
        </div>

        <div>
          <label className={etiqueta} htmlFor="html_content">
            HTML de la plantilla
          </label>
          <textarea
            id="html_content"
            name="html_content"
            required
            rows={16}
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            className={`${campo} font-mono text-xs`}
          />
          <p className="mt-1 text-xs text-slate-400">
            HTML/CSS/JS autocontenido, sin React ni Tailwind — usá {'{{clave}}'} para los placeholders
            declarados arriba, más el reservado {'{{__landing_id__}}'} en el input oculto del formulario.
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
