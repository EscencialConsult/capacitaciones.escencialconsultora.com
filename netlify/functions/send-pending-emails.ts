import type { Config } from '@netlify/functions';

/**
 * Reemplazo del trigger horario de Apps Script (crearTriggerHorario /
 * enviarPendientes) — corre sola según el `schedule` de abajo, no hace
 * falta activarla a mano como el trigger viejo.
 *
 * Bug real confirmado (2026-08-26) — el trabajo pesado NO vive acá:
 * las funciones programadas tienen un límite duro de 30 segundos en
 * Netlify, sin excepción, y con más de un par de emails pendientes en
 * el mismo ciclo (cada uno con su propia red de reintentos/backoff) el
 * envío se cortaba a mitad de camino — filas quedaban en 'processing'
 * para siempre, sin error ni éxito, porque Netlify mataba la función
 * antes de que terminara el intento. Esta función ahora solo DISPARA
 * process-pending-emails-background.ts (hasta 15 minutos de límite,
 * ver ese archivo) y termina al toque — patrón oficial de Netlify para
 * trabajo programado que puede tardar más de 30s.
 */
export default async () => {
  const baseUrl = process.env.URL ?? process.env.DEPLOY_URL ?? '';
  const secreto = process.env.INTERNAL_FUNCTION_SECRET ?? '';

  const respuesta = await fetch(`${baseUrl}/.netlify/functions/process-pending-emails-background`, {
    method: 'POST',
    headers: { 'x-internal-secret': secreto },
  });

  console.log('send-pending-emails: disparó process-pending-emails-background, status', respuesta.status);
};

export const config: Config = {
  schedule: '0 * * * *', // cada 1 hora en punto, igual que el trigger viejo
};
