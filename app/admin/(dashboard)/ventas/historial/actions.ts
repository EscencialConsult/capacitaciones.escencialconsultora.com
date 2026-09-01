'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServiceClient, requireAdmin } from '@/lib/supabase/server';

/**
 * Restablecer una venta ya revisada, a pendiente (2026-09-01, pedido
 * explícito: "si se puede restablecer y cambiar la situación de un
 * lead que se haya rechazado, aprobado, también cambiarlo") — vuelve a
 * la cola de /admin/ventas/revisar como si nunca se hubiera decidido.
 * Ver el comentario largo en la migración 0039 sobre el límite real:
 * no reactiva emails ya cancelados, solo le saca la marca de vendido
 * al lead si esta era la única venta confirmada que la justificaba.
 */
export async function restablecerVenta(ventaId: string) {
  if (!(await requireAdmin())) {
    return { error: 'No autorizado.' };
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.rpc('restablecer_venta', { p_venta_id: ventaId });

  if (error || !data) {
    console.error('Error en restablecer_venta:', error);
    return { error: 'No se pudo restablecer. Probá de nuevo.' };
  }

  const r = data as { error?: string };
  if (r.error === 'no_existe') {
    return { error: 'Esta venta ya no existe.' };
  }
  if (r.error === 'no_revisada') {
    return { error: 'Esta venta ya está pendiente — no hay nada que restablecer.' };
  }

  revalidatePath('/admin/ventas/historial');
  revalidatePath('/admin/ventas/revisar');
  revalidatePath('/admin/ventas');
  revalidatePath('/admin', 'layout');
  return { ok: true as const };
}
