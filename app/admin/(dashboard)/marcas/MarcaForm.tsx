'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { X } from 'lucide-react';
import { crearMarcaPersonalizada } from './actions';
import { FormInput, inputClass, labelClass } from '../FormInput';

function BotonGuardar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-one-fucsia px-6 py-2.5 text-sm font-bold text-one-negro transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-one-fucsia disabled:pointer-events-none disabled:opacity-60"
    >
      {pending ? 'Creando...' : 'Crear marca'}
    </button>
  );
}

/**
 * Chips de color (2026-08-28) — mismo truco que variables_meta en
 * TemplateForm.tsx: la lista real vive en un input hidden (colores),
 * este componente solo la arma con clicks. Un <input type="color">
 * junto al hex a mano porque no todos los colores de una marca real
 * salen redondos (ver MARCAS hardcodeada — "#e17bd7" no es algo que se
 * escriba a ojo fácil), así que hace falta poder pegar el hex exacto.
 */
function SelectorColores({ colores, onChange }: { colores: string[]; onChange: (colores: string[]) => void }) {
  const [colorNuevo, setColorNuevo] = useState('#000000');

  const agregar = () => {
    const hex = colorNuevo.trim();
    if (!hex || colores.includes(hex)) return;
    onChange([...colores, hex]);
  };

  return (
    <div>
      <label className={labelClass}>Colores de la marca</label>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(colorNuevo) ? colorNuevo : '#000000'}
          onChange={(e) => setColorNuevo(e.target.value)}
          className="size-9 shrink-0 cursor-pointer rounded-one-sm border border-one-oscuro/15 bg-transparent p-0.5"
          title="Elegir color"
        />
        <input
          type="text"
          value={colorNuevo}
          onChange={(e) => setColorNuevo(e.target.value)}
          placeholder="#e17bd7"
          className={`${inputClass} mt-0 font-mono`}
        />
        <button
          type="button"
          onClick={agregar}
          className="shrink-0 rounded-full border border-one-oscuro/15 px-4 py-2 text-xs font-bold text-one-oscuro transition-colors duration-150 hover:bg-one-oscuro/5"
        >
          + Agregar
        </button>
      </div>
      {colores.length === 0 ? (
        <p className="mt-2 text-xs text-one-dorado">Agregá al menos un color de la paleta.</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {colores.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1.5 rounded-full border border-one-oscuro/10 py-1 pr-1 pl-2 text-xs font-mono text-one-oscuro"
            >
              <span className="size-3.5 shrink-0 rounded-full border border-one-oscuro/10" style={{ backgroundColor: c }} />
              {c}
              <button
                type="button"
                onClick={() => onChange(colores.filter((x) => x !== c))}
                aria-label={`Sacar ${c}`}
                className="rounded-full p-0.5 text-one-oscuro/40 transition-colors duration-150 hover:bg-one-rojo/10 hover:text-one-rojo"
              >
                <X className="size-3" strokeWidth={2.5} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Un input de archivo con vista previa chica — mismos 3 logos que ya
 * pide cada marca fija de MARCAS (fondo oscuro, fondo claro, ícono
 * solo), mismo motivo: el prompt de plantilla elige cuál usar según
 * dónde va (nav sobre fondo claro, footer sobre fondo oscuro, favicon).
 */
function InputLogo({
  id,
  name,
  label,
  hint,
  requerido,
}: {
  id: string;
  name: string;
  label: string;
  hint: string;
  requerido: boolean;
}) {
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <div>
      <label className={labelClass} htmlFor={id}>
        {label}
      </label>
      <div className="mt-1 flex items-center gap-3">
        <div
          className={`flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-one-sm border border-one-oscuro/15 ${
            label.toLowerCase().includes('oscuro') ? 'bg-one-oscuro' : 'bg-one-oscuro/5'
          }`}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- vista previa de un File local (blob:), next/image no aplica acá
            <img src={preview} alt="" className="size-full object-contain p-1" />
          ) : (
            <span className="text-[10px] text-one-oscuro/30">sin logo</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <input
            id={id}
            name={name}
            type="file"
            accept="image/*"
            required={requerido}
            onChange={(e) => {
              const file = e.target.files?.[0];
              setPreview(file ? URL.createObjectURL(file) : null);
            }}
            className="block w-full text-xs text-one-oscuro/70 file:mr-3 file:rounded-full file:border-0 file:bg-one-oscuro/5 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-one-oscuro hover:file:bg-one-oscuro/10"
          />
          <p className="mt-1 text-xs text-one-oscuro/40">{hint}</p>
        </div>
      </div>
    </div>
  );
}

export function MarcaForm() {
  const [state, formAction] = useFormState(crearMarcaPersonalizada, undefined);
  const [colores, setColores] = useState<string[]>([]);

  return (
    <form action={formAction} className="mt-6 max-w-2xl space-y-6 rounded-one-lg bg-one-blanco p-6 shadow-one-sm ring-1 ring-one-oscuro/5">
      <FormInput id="nombre" name="nombre" label="Nombre de la marca" required placeholder="Ej: Mariana RRHH" />

      <input type="hidden" name="colores" value={colores.join(',')} />
      <SelectorColores colores={colores} onChange={setColores} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormInput
          id="tipografia_principal"
          name="tipografia_principal"
          label="Tipografía principal"
          required
          placeholder="Ej: Poppins"
          hint="Tiene que existir en Google Fonts — es lo que la IA va a usar para los títulos."
        />
        <FormInput
          id="tipografias_secundarias"
          name="tipografias_secundarias"
          label="Tipografías secundarias"
          placeholder="Ej: Inter, Roboto"
          hint="Separadas por coma — alternativas para el resto del texto."
        />
      </div>

      <FormInput
        id="degradado"
        name="degradado"
        label="Degradado característico (opcional)"
        placeholder="Ej: de #280640 a #6e3eab"
        hint="Si la marca tiene uno — se usa en el hero o el botón principal, no es obligatorio."
      />

      <div className="space-y-4 border-t border-one-oscuro/10 pt-5">
        <p className={labelClass}>
          Logos <span className="font-normal text-one-oscuro/40">— los 3, igual que las marcas fijas del sistema</span>
        </p>
        <InputLogo
          id="logo_blanco"
          name="logo_blanco"
          label="Para fondo oscuro/de color"
          hint="El logo en blanco (o claro) — se usa sobre fondos oscuros."
          requerido
        />
        <InputLogo
          id="logo_negro"
          name="logo_negro"
          label="Para fondo claro"
          hint="El logo en negro (o su color normal) — se usa sobre fondos blancos/claros."
          requerido
        />
        <InputLogo
          id="logo_isotipo"
          name="logo_isotipo"
          label="Ícono solo (isotipo)"
          hint="Solo el símbolo, sin el nombre — para favicon, badges, espacios chicos."
          requerido
        />
      </div>

      {state?.error && <p className="text-sm font-medium text-one-rojo">{state.error}</p>}

      <BotonGuardar />
    </form>
  );
}
