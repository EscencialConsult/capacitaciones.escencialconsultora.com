'use client';

import { useMemo, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { CopyPromptButton } from './CopyPromptButton';
import {
  HTML_BASE,
  HTML_BASE_ENVIO_PERSONALIZADO,
  extraerVariablesDeHtml,
  combinarVariables,
  MARCAS,
  type VariableSchema,
  type Marca,
  type MarcaPersonalizada,
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

export function TemplateForm({
  action,
  botonTexto,
  valoresIniciales,
  campanasConectadas = 0,
  envioPersonalizadoPorDefecto = false,
  marcasPersonalizadas = [],
}: {
  action: Accion;
  botonTexto: string;
  valoresIniciales?: {
    name: string;
    marca: Marca | null;
    // Solo uno de los dos viene con valor a la vez — nunca los dos
    // juntos, ver el comentario en templates/actions.ts → templateSchema.
    marca_personalizada_id?: string | null;
    html_content: string;
    variables_schema: VariableSchema[] | null;
    is_active: boolean;
    envio_personalizado: boolean;
    // Para el control de concurrencia optimista de updateTemplate — el
    // valor tal cual vino de la base al abrir el formulario, viaja de
    // vuelta como input hidden para que el servidor pueda detectar si
    // alguien más guardó esta plantilla mientras tanto.
    updated_at?: string;
  };
  // Marcas creadas desde /admin/marcas (2026-08-28) — se suman como
  // grupo aparte en el selector de "Marca", además de las 4 fijas de
  // MARCAS. Vacío en "Nueva plantilla" desde el flujo viejo, siempre se
  // pasa la lista real desde templates/new/page.tsx.
  marcasPersonalizadas?: MarcaPersonalizada[];
  // Cuántas campañas dependen de esta plantilla hoy (a través de sus
  // landings) — 0 en "Nueva plantilla", siempre. Con más de 0, el HTML
  // queda de solo lectura: cambiar los {{clave}} de una plantilla en
  // uso deja huérfano el contenido que esas campañas ya tenían cargado
  // con los nombres viejos (ver updateTemplate, que lo re-valida server
  // side — esto acá es solo para no dejar ni escribir en el textarea).
  campanasConectadas?: number;
  // Solo para "Nueva plantilla" (sin valoresIniciales) — si venís del
  // botón "+ Nueva plantilla" de la pestaña "Envío personalizado", el
  // checkbox arranca ya marcado en vez de que lo tengas que tildar vos.
  envioPersonalizadoPorDefecto?: boolean;
}) {
  const bloqueada = campanasConectadas > 0;
  // Solo se ofrece el control si ya venís del apartado de envío
  // personalizado (creando una nueva desde esa pestaña) o si estás
  // editando una que ya es de ese tipo — nunca aparece en el flujo
  // normal de "Nueva plantilla".
  const mostrarEnvioPersonalizado = envioPersonalizadoPorDefecto || (valoresIniciales?.envio_personalizado ?? false);
  const [state, formAction] = useFormState(action, undefined);
  // Un solo valor de texto codifica los 3 casos posibles del <select>
  // de abajo — 'none' (sin marca fija, elección explícita), un slug de
  // MARCAS (marca fija), o "custom:<uuid>" (marca propia). En "Nueva
  // plantilla" arranca vacío a propósito: el placeholder disabled del
  // <select> obliga a elegir algo antes de poder guardar (2026-08-28,
  // pedido explícito — antes se podía guardar sin marca en silencio).
  // Editando una plantilla vieja sin marca (de antes de este cambio),
  // arranca en 'none' — es funcionalmente lo mismo que ya tenía, no la
  // fuerza a elegir de nuevo.
  const [marcaSeleccionada, setMarcaSeleccionada] = useState<string>(() => {
    if (!valoresIniciales) return '';
    if (valoresIniciales.marca_personalizada_id) return `custom:${valoresIniciales.marca_personalizada_id}`;
    if (valoresIniciales.marca) return valoresIniciales.marca;
    return 'none';
  });
  const marcaFija: Marca | null =
    marcaSeleccionada && marcaSeleccionada !== 'none' && !marcaSeleccionada.startsWith('custom:')
      ? (marcaSeleccionada as Marca)
      : null;
  const marcaPersonalizadaSeleccionada = marcaSeleccionada.startsWith('custom:')
    ? (marcasPersonalizadas.find((m) => m.id === marcaSeleccionada.slice('custom:'.length)) ?? null)
    : null;
  const [envioPersonalizado, setEnvioPersonalizado] = useState(
    valoresIniciales?.envio_personalizado ?? envioPersonalizadoPorDefecto
  );
  const [html, setHtml] = useState(
    valoresIniciales?.html_content ?? (envioPersonalizadoPorDefecto ? HTML_BASE_ENVIO_PERSONALIZADO : HTML_BASE)
  );
  // Ya no se edita desde acá (ver el input hidden más abajo) — se calcula
  // una sola vez de lo que la plantilla ya tuviera guardado, para que ese
  // dato viejo no se pierda en el próximo guardado.
  const [variablesMeta] = useState(() => serializarDescripciones(valoresIniciales?.variables_schema ?? []));
  // Plantillas grandes detectan 80-100+ variables — mostrarlas todas de
  // una tapaba media pantalla de chips (2026-08-25, bug real reportado).
  // Arranca colapsado a un par de filas; el botón "+N más" al final de
  // la fila destapa el resto sin sacar nada de funcionalidad.
  const [mostrarTodasLasVariables, setMostrarTodasLasVariables] = useState(false);
  const LIMITE_VARIABLES_VISIBLES = 12;
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
  return (
    <form action={formAction} className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Control de concurrencia optimista — ver actions.ts (updateTemplate).
          Solo tiene valor en edición; en "Nueva plantilla" viaja vacío y
          el servidor ni lo mira porque ese flujo no pasa por updateTemplate. */}
      {valoresIniciales?.updated_at && (
        <input type="hidden" name="expected_updated_at" defaultValue={valoresIniciales.updated_at} />
      )}
      <div
        style={{ '--stagger-index': 0 } as React.CSSProperties}
        className="stagger-in space-y-4 rounded-one-lg bg-one-blanco p-6 shadow-one-sm ring-1 ring-one-oscuro/5"
      >
        <FormInput id="name" name="name" label="Nombre" required defaultValue={valoresIniciales?.name} />

        <div>
          <label className={labelClass} htmlFor="marca">
            Marca
          </label>
          <select
            id="marca"
            name="marca"
            required
            value={marcaSeleccionada}
            onChange={(e) => setMarcaSeleccionada(e.target.value)}
            className={inputClass}
          >
            {/* disabled a propósito (2026-08-28, pedido explícito) — obliga a
                elegir algo real antes de poder guardar, en vez de dejar
                pasar una plantilla sin marca definir en silencio. */}
            <option value="" disabled>
              — Elegí una marca —
            </option>
            <option value="none">Sin marca fija (estilo 100% libre)</option>
            <optgroup label="Marcas fijas del sistema">
              {(Object.keys(MARCAS) as Marca[]).map((m) => (
                <option key={m} value={m}>
                  {MARCAS[m].nombre}
                </option>
              ))}
            </optgroup>
            {marcasPersonalizadas.length > 0 && (
              <optgroup label="Tus marcas">
                {marcasPersonalizadas.map((m) => (
                  <option key={m.id} value={`custom:${m.id}`}>
                    {m.nombre}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <p className="mt-1 text-xs text-one-oscuro/40">
            Si elegís una marca, el prompt de abajo fija su paleta, tipografía y logos exactos — ya
            no hay que definir colores a mano cada vez.{' '}
            <a href="/admin/marcas/new" target="_blank" rel="noreferrer" className="font-semibold text-one-fucsia hover:underline">
              ¿Necesitás crear una marca nueva?
            </a>
          </p>
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

        {/* Exclusivo del apartado "Envío personalizado" (2026-08-24,
            pedido de Facundo): en el flujo normal de "Nueva plantilla"
            esto ni se muestra — solo aparece si ya venís de esa pestaña
            (envioPersonalizadoPorDefecto, ver templates/new/page.tsx →
            ?tipo=personalizado) o si estás editando una plantilla que
            ya es de este tipo. Nunca se ofrece como una opción más
            dentro de la creación de una plantilla común. */}
        {mostrarEnvioPersonalizado && (
          <div>
            <label className={`flex items-center gap-2 text-sm font-semibold text-one-oscuro ${bloqueada ? 'cursor-not-allowed opacity-50' : ''}`}>
              <input
                type="checkbox"
                id="envio_personalizado"
                name="envio_personalizado"
                value="true"
                checked={envioPersonalizado}
                // Los checkbox no soportan readOnly (a diferencia de un
                // <input type="text">) — nunca lo pongo "disabled" porque
                // eso lo saca por completo del FormData al enviar, y el
                // servidor interpretaría "no vino" como false, pisando un
                // true existente en silencio. En vez de eso, cuando está
                // bloqueada simplemente ignoro el click (el estado
                // controlado lo devuelve a como estaba, así sigue
                // mandando su valor real de siempre) — el bloqueo posta
                // lo hace el servidor en updateTemplate, mismo criterio
                // que ya usa para html_content.
                onChange={(e) => {
                  if (bloqueada) return;
                  setEnvioPersonalizado(e.target.checked);
                }}
                className="size-4 rounded border-one-oscuro/30 accent-one-fucsia focus:ring-2 focus:ring-one-fucsia/20"
              />
              Envío personalizado
            </label>
            <p className="mt-1 text-xs text-one-oscuro/40">
              El lead elige una de 4 opciones al registrarse, y eso decide cuál de los 4 emails de
              la campaña se le manda al instante — en vez del goteo normal de días. Cambia el HTML
              base (agrega un selector al formulario), así que{' '}
              {bloqueada
                ? 'quedó bloqueado por las mismas campañas conectadas de arriba.'
                : 'no se va a poder tocar una vez que esta plantilla tenga campañas conectadas.'}
            </p>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between">
            <label className={labelClass} htmlFor="html_content">
              HTML de la plantilla
            </label>
            <CopyPromptButton
              marca={marcaFija}
              marcaPersonalizada={marcaPersonalizadaSeleccionada}
              envioPersonalizado={envioPersonalizado}
            />
          </div>
          {bloqueada && (
            <p className="mb-2 rounded-one-sm bg-one-dorado/10 px-3 py-2 text-xs text-one-oscuro/70">
              Esta plantilla tiene {campanasConectadas} campaña{campanasConectadas === 1 ? '' : 's'}{' '}
              conectada{campanasConectadas === 1 ? '' : 's'} — el HTML quedó de solo lectura. Cambiar los{' '}
              {'{{clave}}'} de una plantilla en uso deja huérfano el contenido que esas campañas ya
              tenían cargado con los nombres viejos. Si necesitás otro diseño, creá una plantilla nueva
              (nombre, marca y estado sí se pueden guardar acá).
            </p>
          )}
          <textarea
            id="html_content"
            name="html_content"
            required
            readOnly={bloqueada}
            rows={16}
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            className={`${inputClass} font-mono text-xs ${bloqueada ? 'cursor-not-allowed bg-one-oscuro/5 text-one-oscuro/50' : ''}`}
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
              {(mostrarTodasLasVariables
                ? variablesDetectadas
                : variablesDetectadas.slice(0, LIMITE_VARIABLES_VISIBLES)
              ).map((v) => (
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
              {variablesDetectadas.length > LIMITE_VARIABLES_VISIBLES && (
                <button
                  type="button"
                  onClick={() => setMostrarTodasLasVariables((v) => !v)}
                  className="rounded-full bg-one-oscuro/5 px-2.5 py-0.5 text-xs font-semibold text-one-oscuro/60 transition-colors duration-150 hover:bg-one-oscuro/10 hover:text-one-oscuro"
                >
                  {mostrarTodasLasVariables
                    ? 'Mostrar menos'
                    : `+${variablesDetectadas.length - LIMITE_VARIABLES_VISIBLES} más`}
                </button>
              )}
            </div>
          </div>

          {/* Sacado de esta pantalla (2026-08-25, pedido explícito) — describir
              QUÉ va en cada variable es una decisión de campaña, no de
              plantilla: acá solo importa qué {{clave}} existen (los chips de
              arriba), no su contenido. Sigue viajando como campo oculto para
              no perder en el próximo guardado la descripción que una
              plantilla ya tuviera cargada de antes — simplemente ya no se
              edita desde acá. */}
          <input type="hidden" name="variables_meta" value={variablesMeta} />
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
