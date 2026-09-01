/**
 * Funciones puras del motor de sugerencias de /admin/ventas
 * (2026-09-01, pedido explícito: "un sistema muy avanzado, casi como
 * IA pero sin IA"). Sin acceso a la base acá a propósito — la
 * orquestación (qué consultar, en qué orden) vive en
 * lib/ventas-import.ts, así esto se puede razonar y ajustar sin tener
 * que pensar en Supabase.
 */

// Palabras sin valor para matchear tema (conectores, y el ruido fijo
// que trae siempre el texto de "Programa": "- ID 2437 - JUNIO").
const STOPWORDS = new Set([
  'DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'Y', 'PARA', 'CON', 'EN', 'A', 'AL', 'UN', 'UNA', 'SIN', 'POR', 'SOBRE',
  'ID', 'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE',
  'NOVIEMBRE', 'DICIEMBRE',
]);

/** Mayúsculas, sin tildes, sin puntuación — la base de toda comparación de texto de acá. */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // saca tildes/diacríticos (bloque Unicode de marcas combinantes)
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Palabras con valor real de un texto — sin conectores, sin números sueltos (los "ID 2437" no dicen nada del tema), sin palabras de 1-2 letras. */
export function tokensSignificativos(texto: string): string[] {
  return normalizarTexto(texto)
    .split(' ')
    .filter((t) => t.length > 2 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

/** Cuántas palabras significativas comparten dos textos — el puntaje crudo del matcheo por tema. */
export function palabrasComunes(a: string, b: string): number {
  const tokensA = new Set(tokensSignificativos(a));
  const tokensB = tokensSignificativos(b);
  return tokensB.filter((t) => tokensA.has(t)).length;
}

/** ¿Son la misma persona por nombre+apellido, una vez normalizados? Exacto a propósito (sin fuzzy/Levenshtein) — ya se llega acá con el universo bien acotado por campaña+fecha, así que no hace falta (ni conviene) aflojar más el criterio. */
export function mismoNombre(nombreA: string, apellidoA: string, nombreB: string, apellidoB: string): boolean {
  return normalizarTexto(nombreA) === normalizarTexto(nombreB) && normalizarTexto(apellidoA) === normalizarTexto(apellidoB);
}

/**
 * Últimos N dígitos de un teléfono, sacando todo lo que no sea número
 * (espacios, guiones, +, paréntesis). Comparar por sufijo en vez de el
 * número completo es lo que permite matchear "5493811234567" con
 * "03811234567" con "3811234567" — mismo número local, distinto
 * prefijo de país/característica según quién lo haya tipeado.
 */
export function ultimosDigitos(telefono: string, n = 8): string | null {
  const digitos = telefono.replace(/\D/g, '');
  if (digitos.length < n) return null;
  return digitos.slice(-n);
}

/** ¿La fecha de la venta cae dentro de la ventana en que una campaña estuvo activa? deactivatedAt null = todavía activa (ventana abierta hacia adelante). */
export function fechaDentroDeVentana(
  fechaVenta: Date,
  activatedAt: string | null,
  deactivatedAt: string | null
): boolean {
  if (!activatedAt) return false;
  const inicio = new Date(activatedAt);
  if (fechaVenta < inicio) return false;
  if (!deactivatedAt) return true;
  return fechaVenta <= new Date(deactivatedAt);
}
