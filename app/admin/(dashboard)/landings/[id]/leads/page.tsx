import Link from 'next/link';
import { Check, Clock, X, Minus } from 'lucide-react';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Un color + un ícono por estado real de envío — no decorativo, cada uno
// representa un dato real. El ícono existe para que no haga falta pasar
// el mouse ni conocer el código de color para saber si un email salió.
const estiloEtapa: Record<string, string> = {
  sent: 'bg-emerald-50 text-emerald-600',
  pending: 'bg-amber-50 text-amber-600',
  error: 'bg-one-rojo/10 text-one-rojo',
  skipped: 'bg-one-oscuro/5 text-one-oscuro/40',
  no_aplica: 'bg-one-oscuro/5 text-one-oscuro/25',
};

const iconoEtapa: Record<string, typeof Check> = {
  sent: Check,
  pending: Clock,
  error: X,
  skipped: Minus,
  no_aplica: Minus,
};

const etiquetaEtapa: Record<string, string> = {
  sent: 'enviado',
  pending: 'pendiente todavía',
  error: 'falló el envío',
  skipped: 'salteado',
  no_aplica: 'no aplica',
};

type EmailSend = { status: string; scheduled_for: string; landing_email_step_id: string };

export default async function LandingLeadsPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServiceClient();

  const [{ data: landing }, { data: pasos }, { data: leads }] = await Promise.all([
    supabase
      .from('landings')
      .select('id, name, slug, landing_templates(name)')
      .eq('id', params.id)
      .single(),
    supabase
      .from('landing_email_steps')
      .select('id, step_number, subject')
      .eq('landing_id', params.id)
      .order('step_number', { ascending: true }),
    supabase
      .from('leads')
      .select(
        'id, first_name, last_name, email, phone, whatsapp_clicked_at, whatsapp_clicked_step, created_at, email_sends(status, scheduled_for, landing_email_step_id)'
      )
      .eq('landing_id', params.id)
      .order('created_at', { ascending: false }),
  ]);

  const plantilla = landing?.landing_templates as unknown as { name: string } | null;
  const pasosConfigurados = pasos ?? [];

  return (
    <div>
      <Link href="/admin/landings" prefetch={false} className="text-sm text-one-fucsia hover:underline">
        ← Volver a landings
      </Link>
      <h1 className="mt-2 text-lg font-extrabold text-one-oscuro">
        Leads — {landing?.name ?? '...'} <span className="text-one-oscuro/40">(/{landing?.slug})</span>
      </h1>
      <p className="mt-1 text-sm text-one-oscuro/60">
        Plantilla conectada: <span className="font-semibold text-one-oscuro">{plantilla?.name ?? '—'}</span>
        {' · '}
        {pasosConfigurados.length} {pasosConfigurados.length === 1 ? 'email configurado' : 'emails configurados'}
        {' · '}
        {(leads ?? []).length} {(leads ?? []).length === 1 ? 'lead' : 'leads'}
      </p>

      {/* Referencia de a qué corresponde cada número de etapa más abajo */}
      {pasosConfigurados.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-one-oscuro/50">
          {pasosConfigurados.map((p) => (
            <span key={p.id}>
              <span className="font-semibold text-one-oscuro/70">Etapa {p.step_number}:</span> {p.subject}
            </span>
          ))}
        </div>
      )}

      {/* Qué significa cada color/ícono — sin esto no hay forma de saber
          si "1" en la tabla está enviado o pendiente solo con el número. */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-one-oscuro/50">
        <span className="inline-flex items-center gap-1">
          <Check className="size-3.5 text-emerald-600" strokeWidth={3} /> enviado
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3.5 text-amber-600" strokeWidth={2.5} /> todavía no (pendiente)
        </span>
        <span className="inline-flex items-center gap-1">
          <X className="size-3.5 text-one-rojo" strokeWidth={3} /> falló
        </span>
        <span className="inline-flex items-center gap-1">
          <Minus className="size-3.5 text-one-oscuro/40" strokeWidth={3} /> no aplica para este lead
        </span>
      </div>

      <div className="mt-4 overflow-hidden rounded-one-lg bg-one-oscuro/5">
        <table className="w-full text-sm">
          <thead className="text-left text-one-oscuro/50">
            <tr>
              <th className="px-4 py-3 font-semibold">Nombre</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Teléfono</th>
              <th className="px-4 py-3 font-semibold">Click WhatsApp</th>
              <th className="px-4 py-3 font-semibold">Etapas de email</th>
              <th className="px-4 py-3 font-semibold">Ingresó</th>
            </tr>
          </thead>
          <tbody>
            {(leads ?? []).map((lead) => {
              const sends = (lead.email_sends as EmailSend[]) ?? [];
              // Por cada paso CONFIGURADO en la landing (no por cada envío
              // que exista) — así si un lead entró antes de que se agregara
              // un paso nuevo, esa etapa se ve como "no aplica" en vez de
              // faltar en silencio de la fila.
              const etapas = pasosConfigurados.map((paso) => {
                const envio = sends.find((s) => s.landing_email_step_id === paso.id);
                return { numero: paso.step_number, estado: envio?.status ?? 'no_aplica', fecha: envio?.scheduled_for };
              });
              return (
                <tr key={lead.id} className="border-t border-one-oscuro/5">
                  <td className="px-4 py-3 text-one-oscuro">
                    {lead.first_name} {lead.last_name}
                  </td>
                  <td className="px-4 py-3 text-one-oscuro/70">{lead.email}</td>
                  <td className="px-4 py-3 text-one-oscuro/60">{lead.phone ?? '—'}</td>
                  <td className="px-4 py-3">
                    {lead.whatsapp_clicked_at ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                          <Check className="size-3" strokeWidth={3} />
                          Sí — desde etapa {lead.whatsapp_clicked_step ?? '?'}
                        </span>
                        <span className="text-xs text-one-oscuro/40">
                          {new Date(lead.whatsapp_clicked_at).toLocaleString('es-AR')}
                        </span>
                      </div>
                    ) : (
                      <span className="text-one-oscuro/40">Todavía no</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {etapas.map((e) => {
                        const Icono = iconoEtapa[e.estado] ?? Minus;
                        return (
                          <span
                            key={e.numero}
                            title={`Etapa ${e.numero}: ${etiquetaEtapa[e.estado]}${
                              e.fecha ? ' — ' + new Date(e.fecha).toLocaleString('es-AR') : ''
                            }`}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${estiloEtapa[e.estado] ?? ''}`}
                          >
                            {e.numero}
                            <Icono className="size-3" strokeWidth={3} />
                          </span>
                        );
                      })}
                      {etapas.length === 0 && <span className="text-one-oscuro/40">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-one-oscuro/60">
                    {new Date(lead.created_at).toLocaleString('es-AR')}
                  </td>
                </tr>
              );
            })}
            {(leads ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-one-oscuro/40">
                  Todavía no hay leads en esta landing.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
