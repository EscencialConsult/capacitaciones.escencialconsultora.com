/**
 * Normalización y auto-mapeo de columnas para la carga masiva de leads
 * (2026-08-31, ver SubirLeadsButton.tsx) — separado del componente para
 * no enterrar esta lógica en medio de 300 líneas de JSX, y porque no
 * depende de nada del navegador (podría testearse solo si algún día
 * hay tests).
 *
 * No asume el formato de NINGÚN CRM en particular: el admin mapea las
 * columnas a mano en la pantalla, esto solo PROPONE un mapeo inicial
 * por el texto del encabezado para no obligar a elegir las 4 a mano
 * siempre — se corrige fácil si adivinó mal.
 */

// Placeholders reales vistos en un export de CRM (2026-08-31) — "-" para
// cualquier campo vacío, variantes de "sin nombre/apellido". Tratar
// esto como vacío evita guardar el string literal "Sin nombre" como si
// fuera el nombre de la persona.
const VALORES_VACIOS = new Set([
  '-',
  '--',
  'n/a',
  'na',
  's-n',
  'sin nombre',
  'sin apellido',
  'sin dato',
  'sin datos',
  'sin email',
  'sin telefono',
  'sin teléfono',
]);

/** Trata los placeholders típicos de un export de CRM como si no hubiera dato. */
export function limpiarValorCrm(valor: unknown): string | null {
  if (valor == null) return null;
  const texto = String(valor).trim();
  if (!texto) return null;
  if (VALORES_VACIOS.has(texto.toLowerCase())) return null;
  return texto;
}

const PATRON_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Como limpiarValorCrm, pero además descarta cualquier cosa que no tenga forma de email real (ej. una etiqueta como "Email inválido" cargada en esa columna). */
export function limpiarEmailCrm(valor: unknown): string | null {
  const texto = limpiarValorCrm(valor);
  if (!texto) return null;
  return PATRON_EMAIL.test(texto) ? texto : null;
}

export type CampoLead = 'email' | 'nombre' | 'apellido' | 'telefono';

const PISTAS: Record<CampoLead, RegExp> = {
  email: /correo|e-?mail/i,
  nombre: /^nombre$|first.?name|^name$/i,
  apellido: /apellido|last.?name|surname/i,
  telefono: /tel(é|e)fono|celular|whats\s?app|phone|m[oó]vil/i,
};

/** Adivina qué columna corresponde a cada campo por el texto del encabezado — nunca definitivo, el admin lo confirma o corrige en la pantalla de mapeo. */
export function adivinarMapeo(encabezados: string[]): Record<CampoLead, number | null> {
  const mapeo = { email: null, nombre: null, apellido: null, telefono: null } as Record<CampoLead, number | null>;
  (Object.keys(PISTAS) as CampoLead[]).forEach((campo) => {
    const idx = encabezados.findIndex((h) => PISTAS[campo].test(h));
    mapeo[campo] = idx >= 0 ? idx : null;
  });
  return mapeo;
}
