'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { FormInput, inputClass, labelClass } from '../FormInput';

type Plantilla = { id: string; name: string; envio_personalizado: boolean };
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

// El link público en sí — slug, nombre, categoría, plantilla, estado.
// Sin contenido propio: eso lo trae la campaña que se conecte después
// (ver campaigns/CampaignForm.tsx). Mismo patrón que TemplateForm.tsx,
// más simple (sin editor de HTML — acá no hay HTML propio).
export function LandingForm({
  action,
  templates,
  botonTexto,
  valoresIniciales,
}: {
  action: Accion;
  templates: Plantilla[];
  botonTexto: string;
  valoresIniciales?: {
    slug: string;
    name: string;
    template_id: string;
    is_active: boolean;
    is_test?: boolean;
  };
}) {
  const [state, formAction] = useFormState(action, undefined);
  // Separadas en dos grupos (2026-08-24, pedido de Facundo) — antes era
  // una lista plana y no había forma de saber, sin entrar a cada una,
  // si una plantilla era de goteo normal o de envío personalizado (el
  // lead elige una opción y recibe un solo email al instante) — dos
  // mecánicas de campaña bien distintas, hay que poder elegir a
  // conciencia cuál corresponde para esta landing.
  const plantillasNormales = templates.filter((t) => !t.envio_personalizado);
  const plantillasPersonalizadas = templates.filter((t) => t.envio_personalizado);

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
            <optgroup label="Envío personalizado (el lead elige una opción, recibe 1 solo email)">
              {plantillasPersonalizadas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </optgroup>
          )}
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

      {/* Landing armada solo para mostrarle un diseño a un cliente (no
          una campaña real) — tildar esto le pide a Google que no la
          indexe (X-Robots-Tag: noindex, ver app/[slug]/route.ts), para
          que no termine apareciendo en resultados de búsqueda mezclada
          con la landing definitiva del mismo cliente. */}
      <label className="flex items-center gap-2.5 rounded-one-sm bg-one-oscuro/5 px-3 py-2.5 text-sm font-semibold text-one-oscuro">
        <input
          type="checkbox"
          id="is_test"
          name="is_test"
          value="true"
          defaultChecked={valoresIniciales?.is_test ?? false}
          className="size-4 rounded-sm border-one-oscuro/25 text-one-fucsia accent-one-fucsia focus:ring-2 focus:ring-one-fucsia/30 focus:outline-none"
        />
        Landing de prueba (no indexar en Google)
      </label>

      {state?.error && (
        <p className="rounded-one-sm bg-one-rojo/10 px-3 py-2 text-xs font-medium text-one-rojo">{state.error}</p>
      )}

      <BotonGuardar texto={botonTexto} />
    </form>
  );
}
