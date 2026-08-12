'use client';

import { useMemo, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { NewCategoryModal } from './NewCategoryModal';
import { CopyPromptButton } from './CopyPromptButton';
import {
  HTML_BASE,
  extraerVariablesDeHtml,
  combinarVariables,
  type VariableSchema,
} from '@/lib/landing-template-defaults';
import { FormInput, inputClass, labelClass } from '../FormInput';

// Si la plantilla ya tenía descripciones guardadas (de una vuelta
// anterior), se reconstruye el mismo JSON para prellenar el campo de
// edición — así no se pierden al editar, y se pueden retocar a mano.
function serializarDescripciones(schema: VariableSchema[]): string {
  const conDescripcion = schema.filter((v) => v.description);
  if (conDescripcion.length === 0) return '';
  const obj: Record<string, { label: string; descripcion: string }> = {};
  for (const v of conDescripcion) {
    obj[v.key] = { label: v.label, descripcion: v.description! };
  }
  return JSON.stringify(obj, null, 2);
}

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
    variables_schema: VariableSchema[] | null;
    is_active: boolean;
  };
}) {
  const [state, formAction] = useFormState(action, undefined);
  const [html, setHtml] = useState(valoresIniciales?.html_content ?? HTML_BASE);
  const [variablesMeta, setVariablesMeta] = useState(
    () => serializarDescripciones(valoresIniciales?.variables_schema ?? [])
  );
  const variablesDetectadas = useMemo(() => {
    const detectadas = extraerVariablesDeHtml(html);
    try {
      const descripciones = variablesMeta.trim() ? JSON.parse(variablesMeta) : undefined;
      return combinarVariables(detectadas, descripciones);
    } catch {
      // JSON a medio escribir mientras se tipea — se sigue mostrando lo
      // detectado sin descripción hasta que el JSON vuelva a ser válido.
      return detectadas;
    }
  }, [html, variablesMeta]);
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
            HTML/CSS/JS autocontenido, sin React ni Tailwind (ni ningún framework por CDN — la landing
            tiene que cargar rápido) — usá {'{{clave}}'} para cualquier variable que necesites, más el
            reservado {'{{__landing_id__}}'} en el input oculto del formulario. Ya arranca con la
            plantilla base del sistema viejo — lo único que tenés que subir/cambiar es el HTML, el resto
            del funcionamiento (el fetch, el envío) es siempre el mismo. Si querés un diseño distinto,
            copiá el prompt de arriba y pegáselo a una IA — te va a devolver el HTML completo listo para
            pegar acá, sin tocar la lógica.
          </p>

          <div className="mt-2">
            <p className="text-xs font-semibold text-one-oscuro/60">
              Variables detectadas en este HTML (aparecen solas, no se declaran a mano):
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {variablesDetectadas.length === 0 && (
                <span className="text-xs text-one-dorado">
                  No encontré ningún {'{{clave}}'} en el HTML — la landing no va a tener texto editable
                  por campaña.
                </span>
              )}
              {variablesDetectadas.map((v) => (
                <span
                  key={v.key}
                  title={v.description ? `${v.label} — ${v.description}` : v.label}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    v.description
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-one-fucsia/10 text-one-fucsia'
                  }`}
                >
                  {'{{' + v.key + '}}'}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <label className={labelClass} htmlFor="variables_meta">
              Descripciones de variables (JSON, opcional)
            </label>
            <textarea
              id="variables_meta"
              name="variables_meta"
              rows={4}
              value={variablesMeta}
              onChange={(e) => setVariablesMeta(e.target.value)}
              placeholder={'{\n  "precio_plan_1": { "label": "Precio del plan 1", "descripcion": "Con formato $X.XXX" }\n}'}
              className={`${inputClass} font-mono text-xs`}
            />
            <p className="mt-1 text-xs text-one-oscuro/40">
              Pegá acá el bloque B que te devuelve el prompt de arriba — para cada variable, qué
              contenido/formato va ahí. Es opcional: sin esto la variable igual funciona, solo que el
              prompt de campaña va a mostrar el nombre de la clave nomás, sin explicación. Los chips en
              verde de arriba ya tienen descripción cargada.
            </p>
          </div>
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
