import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

/**
 * Reemplazo del doGet Tracker (Script C del sistema viejo). El lead
 * clickea el botón de WhatsApp del email, pasa por acá primero: se
 * registra el click (solo la primera vez, nunca se pisa) y recién
 * después se redirige a la conversación real de WhatsApp. El sistema
 * nunca manda el WhatsApp — arma el link con el texto prellenado y es
 * el lead quien decide mandarlo desde su propio teléfono.
 *
 * force-dynamic obligatorio: lee el querystring a mano desde
 * `request.url` en vez de `NextRequest.nextUrl`, que es la única forma
 * que Next.js reconoce sola para marcar la ruta como dinámica. Sin esto,
 * Next.js podría cachear la respuesta de UN lead (redirect a wa.me con
 * SU número) y servírsela cacheada a cualquier otro lead que clickee el
 * mismo paso — un bug de datos cruzados, no solo de caché vieja.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const leadId = searchParams.get('lead_id');
  const step = searchParams.get('step');

  if (!leadId) {
    return new NextResponse('Falta el parámetro lead_id.', { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('id, campaign_id, whatsapp_clicked_at')
    .eq('id', leadId)
    .single();

  if (leadError || !lead) {
    return new NextResponse('Link inválido o vencido.', { status: 404 });
  }

  if (!lead.whatsapp_clicked_at) {
    await supabase
      .from('leads')
      .update({
        whatsapp_clicked_at: new Date().toISOString(),
        whatsapp_clicked_step: step ? Number(step) : null,
      })
      .eq('id', leadId);
  }

  const { data: campana } = await supabase
    .from('campaigns')
    .select('whatsapp_number, whatsapp_message')
    .eq('id', lead.campaign_id)
    .single();

  const numero = campana?.whatsapp_number ?? '';
  const mensaje = campana?.whatsapp_message ?? '';
  const urlWhatsapp = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;

  return NextResponse.redirect(urlWhatsapp);
}
