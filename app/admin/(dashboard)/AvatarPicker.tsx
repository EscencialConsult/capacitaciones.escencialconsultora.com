'use client';

import { useId, useState } from 'react';
import Image from 'next/image';
import { Check } from 'lucide-react';
import { AVATARS, rutaAvatar } from '@/lib/avatars';
import { labelClass } from './FormInput';

/**
 * Selector de ícono de perfil (2026-08-24, pedido de Facundo) — lista
 * horizontal deslizable "al estilo Netflix" en vez de una grilla, para
 * que se pueda sumar más íconos a futuro sin que el picker se haga
 * cada vez más alto. Sin upload de imagen propio todavía (no hay banco
 * de imágenes ni endpoint para eso en el proyecto): se elige de este
 * set fijo, guardado como name="avatar" para viajar en cualquier form
 * (CreateUserForm, "Mi perfil") sin que ese form tenga que saber nada
 * de cómo funciona el picker por dentro.
 *
 * Bug real confirmado por react-doctor (2026-08-25) — el <label> de acá
 * no tiene ningún control único que etiquetar (es un grupo de botones,
 * no un input), así que un lector de pantalla no podía asociarlo a
 * nada. Fix: un <span id> + role="group" aria-labelledby en el
 * contenedor, patrón correcto para un widget custom sin un único campo.
 */
export function AvatarPicker({
  name,
  defaultValue,
  claseTitulo = labelClass,
  claseAyuda = 'text-one-oscuro/40',
  claseAnilloInactivo = 'ring-one-oscuro/10',
}: {
  name: string;
  defaultValue?: string;
  /** Overrides para usar este picker sobre fondo oscuro (ver
   * FormRegistro en app/admin/login/LoginScreen.tsx) — los defaults
   * vienen pensados para el panel admin, con fondo claro; ahí un
   * anillo oscuro sobre fondo oscuro es invisible. */
  claseTitulo?: string;
  claseAyuda?: string;
  claseAnilloInactivo?: string;
}) {
  const [seleccionado, setSeleccionado] = useState(defaultValue ?? '');
  const labelId = useId();

  return (
    <div>
      <span id={labelId} className={claseTitulo}>
        Ícono de perfil
      </span>
      <input type="hidden" name={name} value={seleccionado} />
      <div
        role="group"
        aria-labelledby={labelId}
        className="mt-2 flex gap-3 overflow-x-auto pb-2"
        style={{ scrollbarWidth: 'thin' }}
      >
        {AVATARS.map((archivo) => {
          const activo = seleccionado === archivo;
          return (
            <button
              key={archivo}
              type="button"
              onClick={() => setSeleccionado(activo ? '' : archivo)}
              aria-pressed={activo}
              title={activo ? 'Quitar selección' : 'Elegir este ícono'}
              className="relative shrink-0"
            >
              <Image
                src={rutaAvatar(archivo)}
                alt=""
                width={64}
                height={64}
                className={`size-16 rounded-full object-cover ring-2 transition-[box-shadow] duration-150 ${
                  activo ? 'ring-one-fucsia ring-offset-2' : `${claseAnilloInactivo} hover:ring-one-fucsia/50`
                }`}
              />
              {activo && (
                <span className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-one-fucsia text-one-blanco ring-2 ring-one-blanco">
                  <Check className="size-3" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className={`mt-1 text-xs ${claseAyuda}`}>
        Deslizá para ver más opciones. Opcional — sin elegir ninguno, se muestra la inicial del email.
      </p>
    </div>
  );
}
