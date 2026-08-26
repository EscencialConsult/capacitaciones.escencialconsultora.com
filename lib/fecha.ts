/**
 * Bug real confirmado (2026-08-26, reportado por Facundo) — todas las
 * fechas del panel se mostraban con `.toLocaleString('es-AR')` /
 * `.toLocaleDateString('es-AR')` SIN especificar `timeZone`. El
 * argumento 'es-AR' solo define el FORMATO (orden día/mes/año,
 * separadores, 24hs) — no convierte nada a hora de Argentina. Como el
 * servidor (Netlify) corre en UTC, cada hora mostrada quedaba 3 horas
 * adelantada de la hora real de Buenos Aires, sin que nada lo avisara.
 * Estas dos funciones son el único lugar que arma fechas para mostrar
 * en el panel — cualquier pantalla nueva que necesite mostrar una
 * fecha debería usarlas en vez de llamar a toLocaleString directo.
 */
const ZONA_AR = 'America/Argentina/Buenos_Aires';

export function formatFechaHoraAR(fecha: string | Date): string {
  return new Date(fecha).toLocaleString('es-AR', { timeZone: ZONA_AR });
}

export function formatFechaAR(fecha: string | Date): string {
  return new Date(fecha).toLocaleDateString('es-AR', { timeZone: ZONA_AR });
}

export function formatFechaLargaAR(fecha: string | Date): string {
  return new Date(fecha).toLocaleDateString('es-AR', {
    timeZone: ZONA_AR,
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}
