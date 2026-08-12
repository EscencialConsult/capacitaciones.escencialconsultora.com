'use server';

import { revalidatePath } from 'next/cache';
import { processPendingEmails } from '@/lib/email/process-pending';

/**
 * Botón manual "Enviar pendientes ahora" — misma lógica que corre el
 * cron cada 1 hora, pero disparada a mano para poder probar sin esperar
 * ni depender de un deploy. Solo accesible desde /admin (ya protegido
 * por el middleware de sesión).
 *
 * (createLanding/updateLanding/activateCampaign viven en
 * campaigns/actions.ts — el armado de contenido de una campaña se separó
 * de esta pantalla, que ahora es solo de landings ya activadas.)
 */
export async function sendPendingNow() {
  const resultado = await processPendingEmails();
  revalidatePath('/admin/landings');
  return resultado;
}
