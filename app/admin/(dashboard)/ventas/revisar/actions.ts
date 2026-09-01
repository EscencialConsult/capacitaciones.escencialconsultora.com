'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServiceClient, requireAdmin } from '@/lib/supabase/server';

/**
 * Confirmar una venta de la cola (2026-09-01, ver migración 0036) —
 * el admin ya revisó "¿es esta persona?" y "¿a qué campaña
 * corresponde?" en RevisarVentaCard.tsx; acá solo se ejecuta la
 * decisión. Una sola RPC atómica (confirmar_venta): deja rastro en
 * `ventas` Y aplica el efecto real (marca vendido, cancela lo
 * pendiente de ESE lead en TODAS sus campañas).
 */
export async function confirmarVenta(ventaId: string, leadId: string, campaignId: string) {
  const admin = await requireAdmin();
  if (!admin) {
    return { error: 'No autorizado.' };
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.rpc('confirmar_venta', {
    p_venta_id: ventaId,
    p_lead_id: leadId,
    p_campaign_id: campaignId,
    p_revisado_por: admin.id,
  });

  if (error || !data) {
    console.error('Error en confirmar_venta:', error);
    return { error: 'No se pudo confirmar. Probá de nuevo.' };
  }

  const r = data as { error?: string };
  if (r.error === 'no_pendiente') {
    return { error: 'Esta venta ya no está pendiente — otra persona la revisó, o vos mismo hace un segundo.' };
  }

  // Las dos rutas de /admin/ventas (2026-09-01, ver VentasTabs.tsx) —
  // esta revalida su propia cola Y la pestaña de analítica, que
  // también muestra el conteo de confirmadas/pendientes.
  revalidatePath('/admin/ventas/revisar');
  revalidatePath('/admin/ventas');
  revalidatePath('/admin', 'layout');
  return { ok: true as const };
}

/** Rechazar — "esta fila no corresponde a ningún lead nuestro" (o el matcheo sugerido estaba mal y no hay otra persona razonable para elegir). No revierte nada, solo archiva la fila de la cola. */
export async function rechazarVenta(ventaId: string) {
  const admin = await requireAdmin();
  if (!admin) {
    return { error: 'No autorizado.' };
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.rpc('rechazar_venta', {
    p_venta_id: ventaId,
    p_revisado_por: admin.id,
  });

  if (error || !data) {
    console.error('Error en rechazar_venta:', error);
    return { error: 'No se pudo rechazar. Probá de nuevo.' };
  }

  const r = data as { error?: string };
  if (r.error === 'no_pendiente') {
    return { error: 'Esta venta ya no está pendiente.' };
  }

  revalidatePath('/admin/ventas/revisar');
  revalidatePath('/admin/ventas');
  revalidatePath('/admin', 'layout');
  return { ok: true as const };
}

export type LeadEncontrado = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  campaign_id: string;
  campaign_name: string;
  created_at: string;
};

/**
 * Búsqueda manual de leads por nombre/apellido (2026-09-01, pedido
 * explícito) — usada cuando el motor automático no encontró nada
 * razonable. A propósito NO es automática (ver el comentario largo en
 * la migración 0036 sobre el riesgo real de choque de nombres) —
 * busca amplio (ilike, sin acotar a ninguna campaña) y es el admin
 * quien reconoce a la persona entre los resultados, con el contexto de
 * campaña/fecha a la vista.
 */
export async function buscarLeadsPorNombre(query: string): Promise<LeadEncontrado[]> {
  if (!(await requireAdmin())) return [];

  const texto = query.trim();
  if (texto.length < 2) return [];

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from('leads')
    .select('id, first_name, last_name, email, phone, created_at, campaign_id, campaigns(name)')
    .or(`first_name.ilike.%${texto}%,last_name.ilike.%${texto}%`)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error buscando leads por nombre:', error);
    return [];
  }

  return (data ?? []).map((l) => ({
    id: l.id,
    first_name: l.first_name,
    last_name: l.last_name,
    email: l.email,
    phone: l.phone,
    campaign_id: l.campaign_id,
    campaign_name: (l.campaigns as unknown as { name: string } | null)?.name ?? '—',
    created_at: l.created_at,
  }));
}
