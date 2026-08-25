import Image from 'next/image';
import { rutaAvatar } from '@/lib/avatars';

const TAMANOS = {
  sm: { clase: 'size-8', px: 32 },
  md: { clase: 'size-9', px: 36 },
} as const;

/**
 * Ícono de perfil compartido por header/sidebar/lista de usuarios
 * (2026-08-24) — si el usuario todavía no eligió ninguno (cualquier
 * cuenta creada antes de este apartado, o que nunca entró a "Mi
 * perfil"), cae al círculo con la inicial del email que ya existía en
 * el header, para no dejar un hueco vacío en ningún lugar donde esto se
 * use. El anillo de color es el borde "acorde a la página" pedido —
 * mismo acento (one-fucsia) que ya usa el resto del panel para focus
 * rings y el ítem de nav activo (ver DESIGN.md → La Regla de la
 * Rareza Fucsia: acá es la única excepción deliberada, porque un
 * avatar necesita leerse como "de esta plataforma" en cualquier
 * tamaño, no como el CTA de la pantalla).
 */
export function Avatar({
  avatar,
  email,
  size = 'md',
}: {
  avatar?: string | null;
  email?: string | null;
  size?: keyof typeof TAMANOS;
}) {
  const { clase, px } = TAMANOS[size];

  if (avatar) {
    return (
      <Image
        src={rutaAvatar(avatar)}
        alt="Ícono de perfil"
        width={px}
        height={px}
        className={`${clase} shrink-0 rounded-full object-cover ring-2 ring-one-fucsia/40`}
      />
    );
  }

  const inicial = (email ?? 'A').charAt(0).toUpperCase();
  return (
    <div
      className={`flex ${clase} shrink-0 items-center justify-center rounded-full bg-one-fucsia/15 text-sm font-bold text-one-fucsia ring-2 ring-one-fucsia/40`}
    >
      {inicial}
    </div>
  );
}
