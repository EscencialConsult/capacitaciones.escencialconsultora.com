'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useFormState, useFormStatus } from 'react-dom';
import { Link2, Sparkles, FileText, UserRound, ExternalLink, Rocket, CheckCircle2, TriangleAlert, Loader2 } from 'lucide-react';
import { CopyLandingPromptButton } from './CopyLandingPromptButton';
import { NewEmailTemplateModal } from './NewEmailTemplateModal';
import { NewLandingModal } from './NewLandingModal';
import { NewCategoryModal } from '../templates/NewCategoryModal';
import { FormInput, inputClass, labelClass } from '../FormInput';
import { ActivateButton } from './ActivateButton';

// Un solo color con significado real por estado — mismo criterio que
// campaigns/page.tsx (ver ese archivo para el porqué de la paleta).
const badgeEstadoPublicacion: Record<string, string> = {
  draft: 'bg-one-oscuro/5 text-one-oscuro/50',
  active: 'bg-emerald-50 text-emerald-600',
  paused: 'bg-one-dorado/15 text-one-dorado',
  archived: 'bg-one-oscuro/5 text-one-oscuro/40',
};
const textoEstadoPublicacion: Record<string, string> = {
  draft: 'Borrador',
  active: 'Activa',
  paused: 'Pausada',
  archived: 'Archivada',
};

/**
 * Badge de estado del paso Publicación — para 'active' NO confía en el
 * campo de la base a ciegas: confirma con un fetch real a /{slug} que
 * la landing está sirviendo contenido de verdad antes de decir
 * "Activa" (2026-08-26, bug real reportado: una campaña con status
 * 'active' en la base seguía mostrándose como si no lo estuviera —
 * quedaba la duda de si el link ya andaba o no). Mientras no está
 * confirmado dice "En proceso", nunca "Activa" sin haberlo chequeado.
 * La ruta pública (app/[slug]/route.ts) es force-dynamic + no-store —
 * no debería haber demora real — pero esto lo verifica en vez de
 * prometerlo, con reintentos por si la primera consulta pasa justo
 * antes de que el commit de Postgres quede visible.
 */
function EstadoPublicacion({
  campaignStatus,
  slug,
}: {
  campaignStatus: 'draft' | 'active' | 'paused' | 'archived';
  slug?: string;
}) {
  const [enVivo, setEnVivo] = useState<'chequeando' | 'ok' | 'tardando'>('chequeando');

  useEffect(() => {
    if (campaignStatus !== 'active' || !slug) return;
    let cancelado = false;
    let intento = 0;

    async function chequear() {
      intento++;
      try {
        const r = await fetch(`/${slug}`, { cache: 'no-store' });
        if (!cancelado && r.ok) {
          setEnVivo('ok');
          return;
        }
      } catch {
        // sin conexión momentánea, sigue reintentando abajo
      }
      if (cancelado) return;
      if (intento >= 4) {
        setEnVivo('tardando');
        return;
      }
      setTimeout(chequear, 1500);
    }

    setEnVivo('chequeando');
    chequear();
    return () => {
      cancelado = true;
    };
  }, [campaignStatus, slug]);

  // Borrador/pausada/archivada no pretenden estar sirviendo nada — su
  // badge no depende de ningún chequeo, es directo de la base.
  if (campaignStatus !== 'active') {
    return (
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeEstadoPublicacion[campaignStatus]}`}>
        {textoEstadoPublicacion[campaignStatus]}
      </span>
    );
  }

  if (enVivo === 'ok') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
        <CheckCircle2 className="size-3.5" strokeWidth={2.5} />
        Activa — confirmado en vivo
      </span>
    );
  }

  if (enVivo === 'tardando') {
    return (
      <div className="flex flex-col gap-1.5">
        <span
          className="inline-flex w-fit items-center gap-1.5 rounded-full bg-one-rojo/10 px-3 py-1 text-xs font-semibold text-one-rojo"
          title={slug ? `/${slug} no respondió bien` : undefined}
        >
          <TriangleAlert className="size-3.5" strokeWidth={2.5} />
          No se pudo confirmar
        </span>
        <p className="text-xs text-one-oscuro/50">
          La base dice que está activa, pero el link no respondió — revisá que la landing en sí (no
          solo la campaña) esté activa en /admin/landings, o probá &quot;Visualizar landing&quot; en un
          rato.
        </p>
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-one-dorado/15 px-3 py-1 text-xs font-semibold text-one-dorado">
      <Loader2 className="size-3.5 animate-spin" strokeWidth={2.5} />
      En proceso...
    </span>
  );
}

type VariableSchema = { key: string; label: string; type: 'text' | 'textarea'; description?: string };
export type LandingConPlantilla = {
  id: string;
  slug: string;
  name: string;
  landing_templates: { name: string; variables_schema: VariableSchema[] | null; envio_personalizado: boolean } | null;
};
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
  name: string;
  landing_id: string;
  category_id: string | null;
  advisor_name: string | null;
  whatsapp_number: string | null;
  whatsapp_message: string | null;
  variables: Record<string, string>;
  pasos: PasoExistente[];
};

const PASOS = [
  { n: 1, label: 'Landing y datos' },
  { n: 2, label: 'Prompt IA' },
  { n: 3, label: 'Contenido' },
  { n: 4, label: 'Asesora y emails' },
  { n: 5, label: 'Publicación' },
] as const;

function BotonGuardar({ texto, textoPendiente }: { texto: string; textoPendiente: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-one-fucsia px-6 py-2.5 text-sm font-bold text-one-negro transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-one-fucsia focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-one-fucsia/40 disabled:pointer-events-none disabled:opacity-60"
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
  onCrearDiseno,
  envioPersonalizado,
  campoOpcion,
  landingId,
}: {
  numero: 1 | 2 | 3 | 4;
  obligatorio: boolean;
  emailTemplates: EmailPlantilla[];
  valores?: PasoExistente;
  onCrearDiseno: (numero: 1 | 2 | 3 | 4) => void;
  // Plantilla con envio_personalizado=true (ver landing_templates) — el
  // lead elige una opción 1-4 en el formulario público, y SOLO ese
  // email se manda, al instante. Cambia nada más la presentación de
  // este bloque (título y el campo de días, que en este modo no se usa
  // — ver app/api/leads/route.ts): los datos que se guardan (asunto,
  // contenido, diseño) son los mismos campos step{N}_* de siempre.
  envioPersonalizado: boolean;
  // El campo de contenido opcion_N_texto (el texto que ve el LEAD para
  // elegir esta opción en el <select> público) — se muestra acá, junto
  // al email que le corresponde, en vez de suelto entre el resto de las
  // variables del paso 3 (ver el comentario en CampaignForm). Sigue
  // siendo el mismo campo var_opcion_N_texto de siempre — mismo id,
  // mismo name, solo cambia dónde se lo edita.
  campoOpcion?: { key: string; label: string; defaultValue?: string };
  // Solo se usa como `key` del campo de campoOpcion, más abajo — ver el
  // comentario ahí. No se usa para nada más de este bloque a propósito
  // (asunto/contenido/diseño de cada paso NO dependen de la landing
  // elegida, así que no deben remontarse al cambiarla).
  landingId: string;
}) {
  return (
    <section className="rounded-one-lg bg-one-oscuro/5 p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-bold text-one-oscuro">
          {envioPersonalizado ? `Opción ${numero}` : `Email ${numero}`}
        </h2>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            obligatorio ? 'bg-one-dorado/15 text-one-dorado' : 'bg-one-oscuro/5 text-one-oscuro/40'
          }`}
        >
          {obligatorio ? 'Obligatorio' : 'Opcional'}
        </span>
      </div>
      {envioPersonalizado ? (
        <p className="mt-1 text-xs text-one-oscuro/40">
          Se manda al instante, solo si el lead elige esta opción en el formulario — nunca en
          goteo por días.
        </p>
      ) : (
        !obligatorio && (
          <p className="mt-1 text-xs text-one-oscuro/40">
            Dejá asunto y contenido vacíos si no vas a usar este paso — se saltea solo, no hace
            falta escribir nada de relleno.
          </p>
        )
      )}
      {campoOpcion && (
        // key={landingId}: sin esto, dos plantillas de envío
        // personalizado (que SIEMPRE declaran el mismo key
        // "opcion_N_texto" — es la convención, no una coincidencia)
        // comparten el mismo nodo DOM al cambiar de landing en el paso
        // 1, y React lo reutiliza en vez de remontarlo: el texto
        // tipeado para la opción de la landing anterior queda pisando
        // en silencio el campo de la landing nueva. Con la key, React
        // descarta el nodo viejo y el nuevo arranca desde su
        // defaultValue real.
        <div className="mt-4" key={landingId}>
          <FormInput
            id={`var_${campoOpcion.key}`}
            name={`var_${campoOpcion.key}`}
            label={`${campoOpcion.label} — lo que ve el lead para elegir esta opción`}
            defaultValue={campoOpcion.defaultValue}
          />
        </div>
      )}
      <div className={`mt-4 grid grid-cols-1 gap-4 ${envioPersonalizado ? '' : 'sm:grid-cols-[1fr_140px]'}`}>
        <div>
          <div className="flex items-center justify-between">
            <label className={labelClass} htmlFor={`step${numero}_email_template_id`}>
              Diseño de email (opcional)
            </label>
            <button
              type="button"
              onClick={() => onCrearDiseno(numero)}
              className="rounded-one-sm text-xs font-semibold text-one-fucsia transition-colors duration-150 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-one-fucsia/40"
            >
              + Crear diseño
            </button>
          </div>
          {/* Sin diseño elegido, el email se manda igual con un HTML simple
              de respaldo (ver HTML_EMAIL_BASE) — el diseño de una plantilla
              guardada nunca es un requisito para poder mandar la campaña. */}
          <select
            id={`step${numero}_email_template_id`}
            name={`step${numero}_email_template_id`}
            defaultValue={valores?.email_template_id ?? ''}
            className={inputClass}
          >
            <option value="">— Email simple, sin diseño elegido —</option>
            {emailTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        {/* offset_days queda oculto (pero sigue mandándose en 0) en modo
            envío personalizado — app/api/leads/route.ts lo ignora del
            todo para este modo, así que mostrarlo confundiría más de lo
            que ayuda. */}
        {!envioPersonalizado && (
          <FormInput
            id={`step${numero}_offset_days`}
            name={`step${numero}_offset_days`}
            label="Días después del ingreso"
            type="number"
            min={0}
            defaultValue={valores?.offset_days ?? (numero === 1 ? 0 : '')}
            placeholder="0"
          />
        )}
        {envioPersonalizado && (
          <input type="hidden" name={`step${numero}_offset_days`} defaultValue={valores?.offset_days ?? 0} />
        )}
      </div>
      <div className="mt-4">
        {/* Sin "required" HTML5 a propósito (2026-08-14): con el form
            dividido en pasos/tabs, un campo obligatorio escondido en un
            paso que no se visitó bloquea el submit sin mostrar nada (el
            navegador no puede posicionar su globo de validación sobre un
            elemento con display:none). La validación real de "Email 1
            obligatorio" ya la hace el servidor (ver campaignSchema en
            actions.ts) y su mensaje aparece abajo del todo. */}
        <FormInput
          id={`step${numero}_subject`}
          name={`step${numero}_subject`}
          label="Asunto"
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
          defaultValue={valores?.content}
          className={inputClass}
        />
      </div>
    </section>
  );
}

// Formulario único de "campaña" (contenido de marketing: asesora,
// WhatsApp, variables, emails, leads) — SIEMPRE conectada a una Landing
// existente (el link público en sí, ver landings/). Sirve para crear y
// editar: en modo edición se le pasa `valoresIniciales` con la campaña
// + sus pasos ya cargados. El campo "Estado" no existe acá a propósito:
// toda campaña nueva arranca en borrador siempre, y pasar a "activa" es
// una acción aparte (botón "Activar" en la lista de Campañas) — ver
// campaigns/actions.ts.
export function CampaignForm({
  landings,
  emailTemplates,
  templatesParaNuevaLanding,
  categorias,
  action,
  botonTexto,
  botonTextoPendiente,
  valoresIniciales,
  campaignId,
  campaignStatus,
}: {
  landings: LandingConPlantilla[];
  emailTemplates: EmailPlantilla[];
  templatesParaNuevaLanding: { id: string; name: string; envio_personalizado: boolean }[];
  categorias: { id: string; name: string }[];
  action: Accion;
  botonTexto: string;
  botonTextoPendiente: string;
  valoresIniciales?: ValoresIniciales;
  /** Sin id (campaña nueva, todavía sin guardar) el paso 5 no tiene qué activar todavía. */
  campaignId?: string;
  campaignStatus?: 'draft' | 'active' | 'paused' | 'archived';
}) {
  const [state, formAction] = useFormState(action, undefined);
  const pasoPorNumero = (n: number) => valoresIniciales?.pasos.find((p) => p.step_number === n);

  // Pasos tipo wizard (2026-08-14, pedido de Facundo) — 100% libres, se
  // puede saltar a cualquiera clickeando su número, ir y volver las
  // veces que haga falta. No bloquean nada: es solo qué bloque del
  // mismo <form> se ve, los demás siguen montados (ver className
  // "hidden" más abajo) para no perder valores no controlados al
  // cambiar de paso, y "Guardar cambios" queda disponible siempre, no
  // solo en el último paso.
  const [pasoActivo, setPasoActivo] = useState<1 | 2 | 3 | 4 | 5>(1);

  // "¿Ya viste en vivo lo último que guardaste?" (2026-08-14, pedido de
  // Facundo) — el botón "Visualizar landing" (acá y en el paso 5) se
  // pone rosa/con punto cuando hay algo sin chequear a ojo — recién
  // guardado, o editado de nuevo después de guardar. Se apaga solo
  // cuando clickeás ese mismo botón (asumimos que ahí vas a ir a mirar).
  const [cambiosSinRevisar, setCambiosSinRevisar] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (searchParams.get('guardado') === '1') {
      setCambiosSinRevisar(true);
      // Al paso 5 (Publicación), no al 1 (2026-08-26, pedido explícito)
      // — recién guardaste, lo que sigue es activar/confirmar que está
      // en vivo, no volver a ver los datos generales.
      setPasoActivo(5);
      router.replace(pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Se levanta a estado local para poder agregarle al toque el diseño
  // que se cree desde el modal de acceso directo (botón "+ Crear
  // diseño" de cada paso), sin recargar la página ni perder lo que ya
  // se había cargado en el resto del formulario.
  const [listaEmailTemplates, setListaEmailTemplates] = useState(emailTemplates);
  const [pasoModalDiseno, setPasoModalDiseno] = useState<1 | 2 | 3 | 4 | null>(null);
  // El <select> de diseño es no controlado (defaultValue), igual que el
  // resto del form — pisar su .value apenas se crea el diseño nuevo se
  // hacía ANTES de que React terminara de agregar la <option> nueva al
  // DOM (setListaEmailTemplates es async), así que el navegador ignoraba
  // la asignación. Este efecto corre después de ese re-render, cuando la
  // <option> ya existe de verdad.
  const [porSeleccionar, setPorSeleccionar] = useState<{ numero: 1 | 2 | 3 | 4; templateId: string } | null>(null);
  useEffect(() => {
    if (!porSeleccionar) return;
    const select = document.getElementById(
      `step${porSeleccionar.numero}_email_template_id`
    ) as HTMLSelectElement | null;
    if (select) select.value = porSeleccionar.templateId;
    setPorSeleccionar(null);
  }, [porSeleccionar, listaEmailTemplates]);

  // La landing elegida decide qué campos de variables se muestran acá
  // abajo — cada plantilla (de la landing) declara las suyas sola (ver
  // extraerVariablesDeHtml), así que este form no tiene ninguna lista
  // fija de variables hardcodeada. El <select> es controlado (a
  // diferencia de los de diseño de email arriba), así que agregar una
  // landing nueva a la lista y dejarla elegida es un solo setState —
  // no hace falta el hack de useEffect diferido para este caso.
  //
  // IMPORTANTE (2026-08-14, bug real reportado por Facundo): en una
  // campaña NUEVA (sin valoresIniciales) esto NO puede caer en
  // "listaLandings[0]" como estaba antes — landings viene ordenado
  // alfabéticamente (ver .order('name') en new/page.tsx), así que se
  // preseleccionaba en silencio la primera landing del abecedario, con
  // SU plantilla y SUS variables. Si el usuario no se daba cuenta y
  // copiaba el prompt de una, el JSON que la IA devolvía traía las
  // variables de una plantilla distinta a la que en realidad quería
  // cargar — variables "genéricas" o de otro rubro que no coincidían
  // con la landing real. Arranca vacío a propósito: obliga a elegir la
  // landing a mano, así el prompt que se copia siempre es el de la
  // landing que el usuario decidió, nunca uno que cayó ahí por orden
  // alfabético.
  const [listaLandings, setListaLandings] = useState(landings);
  const [landingId, setLandingId] = useState(valoresIniciales?.landing_id ?? '');
  const [modalLandingAbierto, setModalLandingAbierto] = useState(false);

  const [listaCategorias, setListaCategorias] = useState(categorias);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(valoresIniciales?.category_id ?? '');
  const [modalCategoriaAbierto, setModalCategoriaAbierto] = useState(false);
  const landingSeleccionada = useMemo(
    () => listaLandings.find((l) => l.id === landingId) ?? null,
    [listaLandings, landingId]
  );
  const variablesDeLaPlantilla = landingSeleccionada?.landing_templates?.variables_schema ?? [];
  const esEnvioPersonalizado = landingSeleccionada?.landing_templates?.envio_personalizado ?? false;

  // En envío personalizado, opcion_pregunta y opcion_N_texto son las
  // únicas variables que un lead real llega a VER (son el texto del
  // <select> del formulario público) — dejarlas sueltas en el paso 3,
  // mezcladas con el resto del contenido, separaba visualmente "qué
  // dice el botón/opción N" de "qué email manda la opción N" (paso 4),
  // que es exactamente donde surgió la confusión: no quedaba claro que
  // son la misma cosa vista desde dos lugares. Ahora se sacan del grid
  // genérico del paso 3 y se muestran junto al email que le corresponde
  // en el paso 4 — mismo campo `var_opcion_N_texto` de siempre, mismo
  // valor que se guarda, solo cambia DÓNDE se lo ve.
  const variableOpcionPregunta = esEnvioPersonalizado
    ? variablesDeLaPlantilla.find((v) => v.key === 'opcion_pregunta')
    : undefined;
  const variableOpcionTexto = (numero: 1 | 2 | 3 | 4) =>
    esEnvioPersonalizado ? variablesDeLaPlantilla.find((v) => v.key === `opcion_${numero}_texto`) : undefined;
  const variablesPaso3 = esEnvioPersonalizado
    ? variablesDeLaPlantilla.filter((v) => !/^opcion_(pregunta|[1-4]_texto)$/.test(v.key))
    : variablesDeLaPlantilla;

  // Completar a mano campo por campo no es viable en plantillas ricas
  // (hero + beneficios + planes + FAQ pueden ser 40-60 variables), y
  // separar "un JSON para las variables" de "el resto a mano" resultó
  // incómodo en la práctica — este cuadro ahora toma el JSON único que
  // devuelve el prompt (ver armarPromptCampanaNueva: nombre, asesora,
  // whatsapp, emails Y variables juntos) y completa TODO el formulario
  // de una. Pisa el valor de cada <input>/<textarea> directo en el DOM
  // por su id — son campos no controlados, no pelea con React, y lo que
  // quede cargado ahí es lo que se manda al enviar el formulario igual.
  // Lo único que NO completa es qué diseño de email usa cada paso (el
  // <select> de email_template_id) — esa es una elección de diseño, no
  // de contenido, se sigue eligiendo a mano.
  const [jsonPegado, setJsonPegado] = useState('');
  const [mensajeJson, setMensajeJson] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  // El cuadro de JSON no es solo un lugar para pegar — también es un
  // espejo en vivo de lo que ya está cargado en el formulario, para que
  // nunca "se pierda" (ni al entrar a editar una campaña ya cargada, ni
  // si se te va la página): lee directo del DOM (mismos ids que usa
  // aplicarJson) y arma el mismo JSON que generaría el prompt.
  function leerFormularioActual() {
    const val = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? '';
    const variables: Record<string, string> = {};
    for (const v of variablesDeLaPlantilla) variables[v.key] = val(`var_${v.key}`);
    const emails: { step: number; offset_days: number; subject: string; content: string }[] = [];
    for (let n = 1; n <= 4; n++) {
      const subject = val(`step${n}_subject`);
      const content = val(`step${n}_content`);
      if (n === 1 || subject.trim() !== '' || content.trim() !== '') {
        emails.push({ step: n, offset_days: Number(val(`step${n}_offset_days`)) || 0, subject, content });
      }
    }
    return {
      name: val('name'),
      advisor_name: val('advisor_name'),
      whatsapp_number: val('whatsapp_number'),
      whatsapp_message: val('whatsapp_message'),
      variables,
      emails,
    };
  }

  // Guarda el último JSON que armamos nosotros (no lo que el usuario
  // haya tipeado/pegado a mano) — si lo que hay en el cuadro no
  // coincide, significa que hay algo pegado todavía sin aplicar, y no
  // lo pisamos por accidente con el estado actual del formulario.
  const ultimoAutoSync = useRef('');
  const syncTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function sincronizarJson() {
    const json = JSON.stringify(leerFormularioActual(), null, 2);
    ultimoAutoSync.current = json;
    setJsonPegado(json);
  }

  // Al entrar a la pantalla (o al cambiar de landing, que cambia qué
  // variables existen) se refleja lo que ya está cargado — así el
  // cuadro nunca arranca vacío ni desactualizado, ni siquiera editando
  // una campaña que ya tenía todo cargado de antes. Esto NO cuenta como
  // "cambio sin revisar" — es solo reflejar lo que ya había, no algo
  // nuevo que el usuario acaba de tocar.
  useEffect(() => {
    sincronizarJson();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variablesDeLaPlantilla]);

  function alTipearEnElFormulario(e: React.FormEvent<HTMLFormElement>) {
    const target = e.target as HTMLElement;
    if (target.id === 'json_campana') return;
    if (jsonPegado !== ultimoAutoSync.current) return; // hay algo pegado sin aplicar, no lo pisamos
    setCambiosSinRevisar(true);
    if (syncTimeout.current) clearTimeout(syncTimeout.current);
    syncTimeout.current = setTimeout(sincronizarJson, 400);
  }

  function aplicarJson() {
    let datos: unknown;
    try {
      datos = JSON.parse(jsonPegado);
    } catch {
      setMensajeJson({ tipo: 'error', texto: 'Ese texto no es JSON válido — revisá que empiece con { y termine con }.' });
      return;
    }
    if (typeof datos !== 'object' || datos === null || Array.isArray(datos)) {
      setMensajeJson({ tipo: 'error', texto: 'Tiene que ser un objeto { ... }, no una lista ni un texto suelto.' });
      return;
    }

    let completados = 0;
    const d = datos as Record<string, unknown>;
    const setValor = (id: string, valor: unknown) => {
      if (valor === undefined || valor === null) return;
      const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
      if (el) {
        el.value = String(valor);
        completados++;
      }
    };

    setValor('name', d.name);
    setValor('advisor_name', d.advisor_name);
    setValor('whatsapp_number', d.whatsapp_number);
    setValor('whatsapp_message', d.whatsapp_message);

    // Si el JSON viene de un prompt viejo (por ejemplo, un chat de IA que
    // arrancó antes de cambiar de landing, o que se armó con menos
    // variables de las que esta plantilla tiene hoy), "vars[v.key]" da
    // undefined para esa clave y setValor no la toca — el campo queda
    // vacío en el form SIN que nada avise. faltantes junta esos casos
    // para poder mostrarlos explícitamente en vez de dejarlos pasar
    // silenciosos (ver mensaje de abajo).
    const faltantes: string[] = [];
    if (d.variables && typeof d.variables === 'object' && !Array.isArray(d.variables)) {
      const vars = d.variables as Record<string, unknown>;
      for (const v of variablesDeLaPlantilla) {
        if (vars[v.key] === undefined || vars[v.key] === null || vars[v.key] === '') {
          faltantes.push(v.label);
        }
        setValor(`var_${v.key}`, vars[v.key]);
      }
    } else if (variablesDeLaPlantilla.length > 0) {
      faltantes.push(...variablesDeLaPlantilla.map((v) => v.label));
    }

    if (Array.isArray(d.emails)) {
      for (const email of d.emails) {
        if (typeof email !== 'object' || email === null) continue;
        const e = email as Record<string, unknown>;
        const paso = Number(e.step);
        if (![1, 2, 3, 4].includes(paso)) continue;
        setValor(`step${paso}_offset_days`, e.offset_days);
        setValor(`step${paso}_subject`, e.subject);
        setValor(`step${paso}_content`, e.content);
      }
    }

    if (completados === 0) {
      setMensajeJson({ tipo: 'error', texto: 'No encontré ningún campo que coincida con este JSON.' });
      return;
    }

    // Se aplicó algo de verdad — el cuadro pasa a reflejar el estado
    // canónico del formulario (no lo que se pegó tal cual), así queda
    // sincronizado para lo que se siga tipeando de acá en más.
    sincronizarJson();
    setCambiosSinRevisar(true);

    const nombreLanding = landingSeleccionada?.landing_templates?.name ?? 'la plantilla';
    if (faltantes.length > 0) {
      // Esto es justo lo que pasó cuando el JSON pegado venía de un
      // prompt desactualizado: la IA devolvió solo 3 variables (titulo,
      // subtitulo, boton_texto) para una plantilla que tiene 59 — el
      // form se completaba "bien" a los ojos del mensaje viejo (que solo
      // contaba campos) sin avisar que faltaba casi todo el contenido.
      const primeras = faltantes.slice(0, 8).join(', ');
      const resto = faltantes.length > 8 ? ` y ${faltantes.length - 8} más` : '';
      setMensajeJson({
        tipo: 'error',
        texto: `Completé ${completados} campos, pero este JSON no trae ${faltantes.length} variable(s) de "${nombreLanding}": ${primeras}${resto}. Probablemente copiaste el prompt antes de elegir esta landing, o desde un chat de IA viejo — copiá el prompt de nuevo (botón de arriba) con esta landing ya elegida y volvé a pedírselo a la IA.`,
      });
      return;
    }

    setMensajeJson({
      tipo: 'ok',
      texto: `Completé ${completados} campos, con las ${variablesDeLaPlantilla.length} variables de "${nombreLanding}" incluidas. Revisá todo (incluido qué diseño de email elegís para cada paso) antes de guardar.`,
    });
  }

  return (
    <>
    <form action={formAction} onInput={alTipearEnElFormulario} className="mt-6">
      {/* Indicador de progreso del wizard — círculo numerado (el único
          elemento sólido en fucsia, chico y contenido, mismo criterio que
          el anillo del Avatar) + línea conectora entre pasos. El tinte de
          fondo del paso activo es SUAVE (one-fucsia/15, mismo idioma que
          el ítem activo del sidebar en DESIGN.md), no sólido — el sólido
          se reserva para "Guardar cambios", la única acción real de esta
          pantalla (ver DESIGN.md → La Regla de la Rareza Fucsia). Los 4
          pasos son 100% libres de visitar en cualquier orden (ver
          comentario más abajo), así que no hay estado "completado" real
          que mostrar — solo dónde estás parado ahora. */}
      <div className="flex flex-wrap items-center gap-1 sm:gap-2">
        {PASOS.map((p, idx) => (
          <div key={p.n} className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => setPasoActivo(p.n)}
              aria-current={pasoActivo === p.n ? 'step' : undefined}
              className={`flex items-center gap-2.5 rounded-full py-1.5 pr-4 pl-1.5 text-sm font-bold transition-[background-color,color] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-one-fucsia/40 ${
                pasoActivo === p.n
                  ? 'bg-one-fucsia/15 text-one-fucsia'
                  : 'text-one-oscuro/50 hover:bg-one-oscuro/5 hover:text-one-oscuro/80'
              }`}
            >
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-extrabold transition-colors duration-200 ease-out ${
                  pasoActivo === p.n ? 'bg-one-fucsia text-one-negro' : 'bg-one-oscuro/10 text-one-oscuro/50'
                }`}
              >
                {p.n}
              </span>
              <span>{p.n === 4 && esEnvioPersonalizado ? 'Asesora y opciones' : p.label}</span>
            </button>
            {idx < PASOS.length - 1 && (
              <span className="hidden h-px w-4 shrink-0 bg-one-oscuro/10 sm:block sm:w-8" aria-hidden="true" />
            )}
          </div>
        ))}
      </div>

      <div className={`mt-6 space-y-6 ${pasoActivo === 1 ? '' : 'hidden'}`}>
        <section className="rounded-one-lg bg-one-oscuro/5 p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-one-oscuro">
            <Link2 className="size-4 text-one-oscuro/40" strokeWidth={2} />
            1. Elegí la landing
          </h2>
          <p className="mt-1 text-xs text-one-oscuro/40">
            El prompt del paso 2 depende de esta elección — cambia según qué variables tenga la
            plantilla de esa landing. Si cambiás de landing acá, volvé a copiar el prompt.
          </p>
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <label className={labelClass} htmlFor="landing_id">
                Landing (link público)
              </label>
              <button
                type="button"
                onClick={() => setModalLandingAbierto(true)}
                className="rounded-one-sm text-xs font-semibold text-one-fucsia transition-colors duration-150 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-one-fucsia/40"
              >
                + Crear landing nueva
              </button>
            </div>
            <div className="flex items-stretch gap-2">
              <select
                id="landing_id"
                name="landing_id"
                value={landingId}
                onChange={(e) => setLandingId(e.target.value)}
                className={`${inputClass} flex-1`}
              >
                {!landingId && <option value="">Elegí una landing</option>}
                {listaLandings.map((l) => (
                  <option key={l.id} value={l.id}>
                    /{l.slug} — {l.name} — {l.landing_templates?.name ?? '—'}
                  </option>
                ))}
              </select>
              {landingSeleccionada && (
                // Estado "hay algo sin revisar" = alerta real, no la acción
                // primaria de la pantalla (esa es "Guardar cambios") — por
                // eso el tratamiento acá es tinte + borde fucsia con un
                // punto que pulsa, nunca fondo sólido (ver DESIGN.md → La
                // Regla de la Rareza Fucsia: un solo sólido por pantalla).
                <a
                  href={`/${landingSeleccionada.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setCambiosSinRevisar(false)}
                  className={
                    cambiosSinRevisar
                      ? 'mt-1 flex items-center gap-2 whitespace-nowrap rounded-one-sm border border-one-fucsia/40 bg-one-fucsia/10 px-4 text-sm font-bold text-one-fucsia transition-[transform,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:bg-one-fucsia/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-one-fucsia/40'
                      : 'mt-1 flex items-center whitespace-nowrap rounded-one-sm border border-one-oscuro/15 px-4 text-sm font-bold text-one-oscuro transition-[transform,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:bg-one-oscuro/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-one-fucsia/40'
                  }
                >
                  {cambiosSinRevisar && <span className="size-2 flex-none rounded-full bg-one-fucsia" />}
                  <ExternalLink className="size-4" strokeWidth={1.75} />
                  {cambiosSinRevisar ? 'Ver cambios en vivo' : 'Visualizar landing'}
                </a>
              )}
            </div>
            {listaLandings.length === 0 && (
              <p className="mt-1 text-xs text-one-dorado">
                Todavía no hay ninguna landing creada — usá el botón de arriba para crear la primera.
              </p>
            )}
            {landingSeleccionada && (
              <p className="mt-1 text-xs text-one-oscuro/40">
                Abre /{landingSeleccionada.slug} tal cual está en vivo ahora mismo — si esta campaña
                todavía no está activa, puede mostrar el contenido de otra campaña activa en esa
                misma landing (o nada, si no hay ninguna).
              </p>
            )}
          </div>
        </section>

        <section className="rounded-one-lg bg-one-oscuro/5 p-5">
          <h2 className="text-sm font-bold text-one-oscuro">Datos generales</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormInput
              id="name"
              name="name"
              label="Nombre interno"
              placeholder="Liquidación Agosto 2026"
              defaultValue={valoresIniciales?.name}
            />
            <div>
              <div className="flex items-center justify-between">
                <label className={labelClass} htmlFor="category_id">
                  Categoría
                </label>
                <button
                  type="button"
                  onClick={() => setModalCategoriaAbierto(true)}
                  className="rounded-one-sm text-xs font-semibold text-one-fucsia transition-colors duration-150 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-one-fucsia/40"
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
          </div>
        </section>
      </div>

      <div className={`mt-6 ${pasoActivo === 2 ? '' : 'hidden'}`}>
        <div className="rounded-one-lg border border-dashed border-one-fucsia/30 bg-one-fucsia/5 p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-one-oscuro">
            <Sparkles className="size-4 text-one-fucsia" strokeWidth={2} />
            2. Copiá el prompt, pegalo en tu IA, y pegá acá lo que te devuelva
          </h2>
          <p className="mt-1 text-xs text-one-oscuro/40">
            {landingSeleccionada ? (
              <>
                El prompt ya trae las {variablesDeLaPlantilla.length} variable(s) de "
                {landingSeleccionada.landing_templates?.name ?? 'la plantilla elegida'}"
              </>
            ) : (
              'Elegí una landing en el paso 1 para habilitar el prompt — sin eso no hay forma de saber qué variables pedirle a la IA.'
            )}{' '}
            — la IA te va a devolver un JSON con todas esas claves completas. Pegalo abajo y
            "Completar formulario" enchufa todo de una (opcional, también podés cargar todo a mano).
            Este cuadro también funciona al revés: siempre muestra lo que ya está cargado en el
            formulario de más abajo, así nunca se pierde — se actualiza solo apenas tipeás algo ahí.
          </p>
          <div className="mt-3 flex items-center justify-between">
            <label className={labelClass} htmlFor="json_campana">
              JSON (reflejo en vivo de lo cargado — pegá acá para reemplazarlo)
            </label>
            <CopyLandingPromptButton landingId={landingId} variables={variablesDeLaPlantilla} disabled={!landingId} />
          </div>
          <textarea
            id="json_campana"
            rows={4}
            value={jsonPegado}
            onChange={(e) => setJsonPegado(e.target.value)}
            placeholder={'{\n  "name": "...",\n  "advisor_name": "...",\n  "variables": { "titulo": "..." },\n  "emails": [{ "step": 1, "offset_days": 0, "subject": "...", "content": "..." }]\n}'}
            className={`${inputClass} font-mono text-xs`}
          />
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={aplicarJson}
              className="rounded-full border border-one-fucsia/40 bg-one-blanco px-4 py-1.5 text-xs font-bold text-one-fucsia transition-[transform,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:bg-one-fucsia/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-one-fucsia/40"
            >
              Completar formulario
            </button>
            {mensajeJson && (
              <span className={`text-xs ${mensajeJson.tipo === 'ok' ? 'text-emerald-600' : 'text-one-rojo'}`}>
                {mensajeJson.texto}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className={`mt-6 ${pasoActivo === 3 ? '' : 'hidden'}`}>
        <section className="rounded-one-lg bg-one-oscuro/5 p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-one-oscuro">
            <FileText className="size-4 text-one-oscuro/40" strokeWidth={2} />
            3. Revisá y ajustá el contenido
          </h2>

          {esEnvioPersonalizado && (
            <p className="mt-1 text-xs text-one-oscuro/40">
              El texto que ve el lead para cada opción (y la pregunta del selector) se cargan en el
              paso 4, junto al email que le corresponde a cada una — no acá.
            </p>
          )}

          {/* key={landingId}: fuerza el remount de todo el bloque al
              cambiar de landing en el paso 1. Sin esto, dos plantillas
              distintas que declaran una variable con el mismo key (ej.
              "titulo"/"subtitulo"/"boton_texto" por convención del
              seed real) comparten el mismo nodo DOM no controlado
              (defaultValue) y React lo reutiliza en vez de remontarlo
              — el contenido tipeado para la landing anterior queda
              pisando en silencio el campo de la landing nueva. */}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2" key={landingId}>
            {variablesPaso3.length === 0 && (
              <p className="text-xs text-one-oscuro/40 sm:col-span-2">
                {landingId
                  ? 'La plantilla de esta landing no tiene ningún {{clave}} en su HTML — no hay texto editable por campaña.'
                  : 'Elegí una landing en el paso 1 para ver qué campos de texto tiene su plantilla.'}
              </p>
            )}
            {variablesPaso3.map((v) =>
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
      </div>

      <div className={`mt-6 space-y-6 ${pasoActivo === 4 ? '' : 'hidden'}`}>
        <section className="rounded-one-lg bg-one-oscuro/5 p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-one-oscuro">
            <UserRound className="size-4 text-one-oscuro/40" strokeWidth={2} />
            Asesora y WhatsApp
          </h2>
          {esEnvioPersonalizado && (
            <p className="mt-1 text-xs text-one-oscuro/40">
              Esta landing es de envío personalizado: el lead elige una de las opciones de abajo al
              registrarse y recibe solo ese email, al instante — no hay goteo por días.
            </p>
          )}
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

        {variableOpcionPregunta && (
          // key={landingId}: mismo caso que el campoOpcion de
          // BloqueEmail — "opcion_pregunta" es un key literalmente
          // idéntico en cualquier par de plantillas de envío
          // personalizado, así que sin la key acá React reutiliza este
          // mismo input al cambiar de landing y arrastra el valor
          // tipeado para la landing anterior.
          <section className="rounded-one-lg bg-one-oscuro/5 p-5" key={landingId}>
            <FormInput
              id={`var_${variableOpcionPregunta.key}`}
              name={`var_${variableOpcionPregunta.key}`}
              label={`${variableOpcionPregunta.label} — el título del selector de opciones que ve el lead`}
              defaultValue={valoresIniciales?.variables[variableOpcionPregunta.key]}
            />
          </section>
        )}

        <BloqueEmail
          numero={1}
          obligatorio
          emailTemplates={listaEmailTemplates}
          valores={pasoPorNumero(1)}
          onCrearDiseno={setPasoModalDiseno}
          envioPersonalizado={esEnvioPersonalizado}
          landingId={landingId}
          campoOpcion={
            variableOpcionTexto(1) && {
              ...variableOpcionTexto(1)!,
              defaultValue: valoresIniciales?.variables[variableOpcionTexto(1)!.key],
            }
          }
        />
        <BloqueEmail
          numero={2}
          obligatorio={false}
          emailTemplates={listaEmailTemplates}
          valores={pasoPorNumero(2)}
          onCrearDiseno={setPasoModalDiseno}
          envioPersonalizado={esEnvioPersonalizado}
          landingId={landingId}
          campoOpcion={
            variableOpcionTexto(2) && {
              ...variableOpcionTexto(2)!,
              defaultValue: valoresIniciales?.variables[variableOpcionTexto(2)!.key],
            }
          }
        />
        <BloqueEmail
          numero={3}
          obligatorio={false}
          emailTemplates={listaEmailTemplates}
          valores={pasoPorNumero(3)}
          onCrearDiseno={setPasoModalDiseno}
          envioPersonalizado={esEnvioPersonalizado}
          landingId={landingId}
          campoOpcion={
            variableOpcionTexto(3) && {
              ...variableOpcionTexto(3)!,
              defaultValue: valoresIniciales?.variables[variableOpcionTexto(3)!.key],
            }
          }
        />
        <BloqueEmail
          numero={4}
          obligatorio={false}
          emailTemplates={listaEmailTemplates}
          valores={pasoPorNumero(4)}
          onCrearDiseno={setPasoModalDiseno}
          envioPersonalizado={esEnvioPersonalizado}
          landingId={landingId}
          campoOpcion={
            variableOpcionTexto(4) && {
              ...variableOpcionTexto(4)!,
              defaultValue: valoresIniciales?.variables[variableOpcionTexto(4)!.key],
            }
          }
        />
      </div>

      <div className={`mt-6 space-y-6 ${pasoActivo === 5 ? '' : 'hidden'}`}>
        <section className="rounded-one-lg bg-one-oscuro/5 p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-one-oscuro">
            <Rocket className="size-4 text-one-oscuro/40" strokeWidth={2} />
            Publicación
          </h2>

          {!campaignId ? (
            <p className="mt-2 text-sm text-one-oscuro/50">
              Guardá la campaña primero (el botón de abajo) — recién ahí se puede activar y confirmar
              que está en vivo.
            </p>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <EstadoPublicacion campaignStatus={campaignStatus ?? 'draft'} slug={landingSeleccionada?.slug} />

                {(campaignStatus === 'draft' || campaignStatus === 'paused') && landingSeleccionada && (
                  <ActivateButton
                    campaignId={campaignId}
                    slug={landingSeleccionada.slug}
                    label={campaignStatus === 'paused' ? 'Reactivar' : 'Activar'}
                    // Vuelve a esta misma pantalla (no a la lista) — ver el
                    // comentario en activateCampaign para el porqué.
                    redirectTo={`/admin/campaigns/${campaignId}/edit?guardado=1`}
                  />
                )}

                {landingSeleccionada && (
                  <a
                    href={`/${landingSeleccionada.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setCambiosSinRevisar(false)}
                    className={
                      cambiosSinRevisar
                        ? 'flex items-center gap-2 whitespace-nowrap rounded-one-sm border border-one-fucsia/40 bg-one-fucsia/10 px-4 py-2 text-sm font-bold text-one-fucsia transition-[transform,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:bg-one-fucsia/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-one-fucsia/40'
                        : 'flex items-center gap-2 whitespace-nowrap rounded-one-sm border border-one-oscuro/15 px-4 py-2 text-sm font-bold text-one-oscuro transition-[transform,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:bg-one-oscuro/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-one-fucsia/40'
                    }
                  >
                    {cambiosSinRevisar && <span className="size-2 flex-none rounded-full bg-one-fucsia" />}
                    <ExternalLink className="size-4" strokeWidth={1.75} />
                    Visualizar landing
                  </a>
                )}
              </div>

              {campaignStatus === 'archived' && (
                <p className="mt-4 text-sm text-one-oscuro/50">
                  Esta campaña está archivada — no se puede reactivar. Creá una campaña nueva si hace
                  falta retomar esto.
                </p>
              )}
            </>
          )}
        </section>
      </div>

      {state?.error && <p className="mt-6 text-sm text-one-rojo">{state.error}</p>}

      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setPasoActivo((p) => (p > 1 ? ((p - 1) as 1 | 2 | 3 | 4) : p))}
          className={`rounded-full px-5 py-2.5 text-sm font-bold text-one-oscuro/70 transition-colors duration-200 ease-out hover:bg-one-oscuro/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-one-fucsia/40 ${
            pasoActivo === 1 ? 'invisible' : ''
          }`}
        >
          ← Anterior
        </button>
        <div className="flex items-center gap-3">
          {pasoActivo < 5 && (
            <button
              type="button"
              onClick={() => setPasoActivo((p) => (p < 5 ? ((p + 1) as 2 | 3 | 4 | 5) : p))}
              className="rounded-full border border-one-oscuro/15 px-5 py-2.5 text-sm font-bold text-one-oscuro transition-colors duration-200 ease-out hover:bg-one-oscuro/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-one-fucsia/40"
            >
              Siguiente →
            </button>
          )}
          <BotonGuardar texto={botonTexto} textoPendiente={botonTextoPendiente} />
        </div>
      </div>
    </form>

    {/* Ambos modales quedan fuera del <form> de campaña a propósito:
        cada uno tiene su propio <form> para crear, y un <form> no puede
        anidar otro <form> — eso rompía la hidratación de React. */}
    {pasoModalDiseno && (
      <NewEmailTemplateModal
        onClose={() => setPasoModalDiseno(null)}
        onCreated={(plantilla) => {
          setListaEmailTemplates((prev) => [...prev, plantilla]);
          setPorSeleccionar({ numero: pasoModalDiseno, templateId: plantilla.id });
          setPasoModalDiseno(null);
        }}
      />
    )}
    {modalLandingAbierto && (
      <NewLandingModal
        onClose={() => setModalLandingAbierto(false)}
        templates={templatesParaNuevaLanding}
        onCreated={(landing) => {
          setListaLandings((prev) => [...prev, landing]);
          setLandingId(landing.id);
          setModalLandingAbierto(false);
        }}
      />
    )}
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
