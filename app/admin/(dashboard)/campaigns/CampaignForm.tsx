'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { CopyLandingPromptButton } from './CopyLandingPromptButton';
import { NewEmailTemplateModal } from './NewEmailTemplateModal';
import { NewLandingModal } from './NewLandingModal';
import { FormInput, inputClass, labelClass } from '../FormInput';

type VariableSchema = { key: string; label: string; type: 'text' | 'textarea'; description?: string };
export type LandingConPlantilla = {
  id: string;
  slug: string;
  name: string;
  landing_templates: { name: string; variables_schema: VariableSchema[] | null } | null;
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
  onCrearDiseno,
}: {
  numero: 1 | 2 | 3 | 4;
  obligatorio: boolean;
  emailTemplates: EmailPlantilla[];
  valores?: PasoExistente;
  onCrearDiseno: (numero: 1 | 2 | 3 | 4) => void;
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
          <div className="flex items-center justify-between">
            <label className={labelClass} htmlFor={`step${numero}_email_template_id`}>
              Diseño de email (opcional)
            </label>
            <button
              type="button"
              onClick={() => onCrearDiseno(numero)}
              className="text-xs text-one-fucsia hover:underline"
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
}: {
  landings: LandingConPlantilla[];
  emailTemplates: EmailPlantilla[];
  templatesParaNuevaLanding: { id: string; name: string }[];
  categorias: { id: string; name: string }[];
  action: Accion;
  botonTexto: string;
  botonTextoPendiente: string;
  valoresIniciales?: ValoresIniciales;
}) {
  const [state, formAction] = useFormState(action, undefined);
  const pasoPorNumero = (n: number) => valoresIniciales?.pasos.find((p) => p.step_number === n);

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
  const [listaLandings, setListaLandings] = useState(landings);
  const [landingId, setLandingId] = useState(valoresIniciales?.landing_id ?? listaLandings[0]?.id ?? '');
  const [modalLandingAbierto, setModalLandingAbierto] = useState(false);
  const variablesDeLaPlantilla = useMemo(
    () => listaLandings.find((l) => l.id === landingId)?.landing_templates?.variables_schema ?? [],
    [listaLandings, landingId]
  );

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
  // una campaña que ya tenía todo cargado de antes.
  useEffect(() => {
    sincronizarJson();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variablesDeLaPlantilla]);

  function alTipearEnElFormulario(e: React.FormEvent<HTMLFormElement>) {
    const target = e.target as HTMLElement;
    if (target.id === 'json_campana') return;
    if (jsonPegado !== ultimoAutoSync.current) return; // hay algo pegado sin aplicar, no lo pisamos
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

    const nombreLanding = listaLandings.find((l) => l.id === landingId)?.landing_templates?.name ?? 'la plantilla';
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
    <form action={formAction} onInput={alTipearEnElFormulario} className="mt-6 space-y-6">
      <section className="rounded-one-lg bg-one-oscuro/5 p-5">
        <h2 className="text-sm font-bold text-one-oscuro">1. Elegí la landing</h2>
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
              className="text-xs text-one-fucsia hover:underline"
            >
              + Crear landing nueva
            </button>
          </div>
          <select
            id="landing_id"
            name="landing_id"
            required
            value={landingId}
            onChange={(e) => setLandingId(e.target.value)}
            className={inputClass}
          >
            {!landingId && <option value="">Elegí una landing</option>}
            {listaLandings.map((l) => (
              <option key={l.id} value={l.id}>
                /{l.slug} — {l.name} — {l.landing_templates?.name ?? '—'}
              </option>
            ))}
          </select>
          {listaLandings.length === 0 && (
            <p className="mt-1 text-xs text-one-dorado">
              Todavía no hay ninguna landing creada — usá el botón de arriba para crear la primera.
            </p>
          )}
        </div>
      </section>

      <div className="rounded-one-lg border border-dashed border-one-fucsia/30 bg-one-fucsia/5 p-5">
        <h2 className="text-sm font-bold text-one-oscuro">
          2. Copiá el prompt, pegalo en tu IA, y pegá acá lo que te devuelva
        </h2>
        <p className="mt-1 text-xs text-one-oscuro/40">
          El prompt ya trae las {variablesDeLaPlantilla.length} variable(s) de "
          {listaLandings.find((l) => l.id === landingId)?.landing_templates?.name ?? 'la plantilla elegida'}
          " — la IA te va a devolver un JSON con todas esas claves completas. Pegalo abajo y
          "Completar formulario" enchufa todo de una (opcional, también podés cargar todo a mano).
          Este cuadro también funciona al revés: siempre muestra lo que ya está cargado en el
          formulario de más abajo, así nunca se pierde — se actualiza solo apenas tipeás algo ahí.
        </p>
        <div className="mt-3 flex items-center justify-between">
          <label className={labelClass} htmlFor="json_campana">
            JSON (reflejo en vivo de lo cargado — pegá acá para reemplazarlo)
          </label>
          <CopyLandingPromptButton variables={variablesDeLaPlantilla} />
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
            className="rounded-full bg-one-fucsia px-4 py-1.5 text-xs font-bold text-one-negro transition-all duration-300 hover:-translate-y-0.5"
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

      <section className="rounded-one-lg bg-one-oscuro/5 p-5">
        <h2 className="text-sm font-bold text-one-oscuro">3. Revisá y ajustá</h2>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormInput
            id="name"
            name="name"
            label="Nombre interno"
            placeholder="Liquidación Agosto 2026"
            required
            defaultValue={valoresIniciales?.name}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {variablesDeLaPlantilla.length === 0 && (
            <p className="text-xs text-one-oscuro/40 sm:col-span-2">
              {landingId
                ? 'La plantilla de esta landing no tiene ningún {{clave}} en su HTML — no hay texto editable por campaña.'
                : 'Elegí una landing arriba para ver qué campos de texto tiene su plantilla.'}
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

      <BloqueEmail
        numero={1}
        obligatorio
        emailTemplates={listaEmailTemplates}
        valores={pasoPorNumero(1)}
        onCrearDiseno={setPasoModalDiseno}
      />
      <BloqueEmail
        numero={2}
        obligatorio={false}
        emailTemplates={listaEmailTemplates}
        valores={pasoPorNumero(2)}
        onCrearDiseno={setPasoModalDiseno}
      />
      <BloqueEmail
        numero={3}
        obligatorio={false}
        emailTemplates={listaEmailTemplates}
        valores={pasoPorNumero(3)}
        onCrearDiseno={setPasoModalDiseno}
      />
      <BloqueEmail
        numero={4}
        obligatorio={false}
        emailTemplates={listaEmailTemplates}
        valores={pasoPorNumero(4)}
        onCrearDiseno={setPasoModalDiseno}
      />

      {state?.error && <p className="text-sm text-one-rojo">{state.error}</p>}

      <BotonGuardar texto={botonTexto} textoPendiente={botonTextoPendiente} />
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
        categorias={categorias}
        onCreated={(landing) => {
          setListaLandings((prev) => [...prev, landing]);
          setLandingId(landing.id);
          setModalLandingAbierto(false);
        }}
      />
    )}
    </>
  );
}
