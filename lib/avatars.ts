/**
 * Íconos de perfil (2026-08-24, pedido de Facundo) — set fijo subido a
 * public/profiles/, no hay upload de imagen propio todavía. Un usuario
 * elige uno de estos al crear su cuenta o después desde "Mi perfil"; se
 * guarda solo el nombre de archivo en user_metadata.avatar (no la ruta
 * completa), así que agregar un ícono nuevo el día de mañana es tan
 * simple como sumar el archivo a public/profiles/ y una línea acá —
 * nunca sacar uno de la lista mientras algún usuario lo tenga elegido.
 */
export const AVATARS = [
  '188.webp',
  '189.webp',
  '190.webp',
  '191.webp',
  '192.webp',
  '193.webp',
  '194.webp',
  '195.webp',
  '196.webp',
  '197.webp',
] as const;

export function rutaAvatar(archivo: string): string {
  return `/profiles/${archivo}`;
}
