'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { NewCategoryModal } from './NewCategoryModal';
import { CopyPromptButton } from './CopyPromptButton';
import { HTML_BASE } from '@/lib/landing-template-defaults';
import { FormInput, inputClass, labelClass } from '../FormInput';

type Categoria = { id: string; name: string };
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
  const [html, setHtml] = useState(valoresIniciales?.html_content ?? HTML_BASE);
  const [listaCategorias, setListaCategorias] = useState(categorias);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(valoresIniciales?.category_id ?? '');
  const [modalAbierto, setModalAbierto] = useState(false);

  return (
    <form action={formAction} className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <FormInput id="name" name="name" label="Nombre" required defaultValue={valoresIniciales?.name} />

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
          {listaCategorias.length === 0 && (
            <p className="mt-1 text-xs text-one-dorado">
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
          <div className="flex items-center justify-between">
            <label className={labelClass} htmlFor="html_content">
              HTML de la plantilla
            </label>
            <CopyPromptButton />
          </div>
          <textarea
            id="html_content"
            name="html_content"
            required
            rows={16}
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            className={`${inputClass} font-mono text-xs`}
          />
          <p className="mt-1 text-xs text-one-oscuro/40">
            HTML/CSS/JS autocontenido, sin React ni Tailwind — usá {'{{clave}}'} para los placeholders
            declarados arriba, más el reservado {'{{__landing_id__}}'} en el input oculto del formulario.
            Ya arranca con la plantilla base del sistema viejo — lo único que tenés que subir/cambiar es
            el HTML, el resto del funcionamiento (el fetch, el envío) es siempre el mismo. Si querés un
            diseño distinto, copiá el prompt de arriba y pegáselo a una IA — te va a devolver el HTML
            completo listo para pegar acá, sin tocar la lógica.
          </p>
        </div>

        {state?.error && <p className="text-sm text-one-rojo">{state.error}</p>}

        <BotonGuardar texto={botonTexto} />
      </div>

      <div>
        <p className={labelClass}>Vista previa en vivo</p>
        <div
          className="mt-1 overflow-hidden rounded-one-md border border-one-oscuro/10"
          style={{ height: 600 }}
        >
          <iframe title="Vista previa" srcDoc={html} className="h-full w-full" sandbox="" />
        </div>
      </div>
    </form>
  );
}
