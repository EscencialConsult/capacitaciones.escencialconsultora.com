import type { Config } from '@netlify/functions';
import { processPendingEmails } from '../../lib/email/process-pending';

/**
 * Reemplazo del trigger horario de Apps Script (crearTriggerHorario /
 * enviarPendientes). Netlify la corre sola según el `schedule` de abajo
 * — no hace falta activarla a mano como el trigger viejo.
 */
export default async () => {
  const resultado = await processPendingEmails();
  console.log('send-pending-emails:', resultado);
};

export const config: Config = {
  schedule: '0 * * * *', // cada 1 hora en punto, igual que el trigger viejo
};
