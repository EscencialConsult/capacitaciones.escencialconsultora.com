import Link from 'next/link';
import { Check, Clock, X, Minus } from 'lucide-react';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { TableShell, TableHead, TableEmptyRow } from '../../../AdminTable';
import { RetryEnvioButton } from './RetryEnvioButton';
import { formatFechaHoraAR } from '@/lib/fecha';

export const dynamic = 'force-dynamic';

// Un color + un ícono por estado real de envío — no decorativo, cada uno
// representa un dato real. El ícono existe para que no haga falta pasar
// el mouse ni conocer el código de color para saber si un email salió.
// Paleta ceñida a DESIGN.md (nunca amber/sky, no son colores de esta marca):
// emerald = éxito, one-dorado = "todavía no, pero no es un error", one-cian
// = acento secundario para el estado transitorio "enviando ahora".
const estiloEtapa: Record<string, string> = {
  sent: 'bg-emerald-50 text-emerald-600',
  pending: 'bg-one-dorado/15 text-one-dorado',
  // 'processing' = reclamado por process-pending.ts pero todavía no confirmó
  // el envío en Brevo (ver supabase/migrations/0010_email_sends_processing_status.sql).
  // Es una ventana corta, pero si la fila queda huérfana ahí, esto evita
  // que se vea como "pendiente todavía" (que confundiría al admin).
  processing: 'bg-one-cian/15 text-one-cian',
  error: 'bg-one-rojo/10 text-one-rojo',
  skipped: 'bg-one-oscuro/5 text-one-oscuro/40',
  no_aplica: 'bg-one-oscuro/5 text-one-oscuro/25',
};

const iconoEtapa: Record<string, typeof Check> = {
  sent: Check,
  pending: Clock,
  processing: Clock,
  error: X,
  skipped: Minus,
  no_aplica: Minus,
};

const etiquetaEtapa: Record<string, string> = {
  sent: 'enviado',
  pending: 'pendiente todavía',
  processing: 'enviando ahora',
  error: 'falló el envío',
  skipped: 'salteado',
  no_aplica: 'no aplica',
};

type EmailSend = { id: string; status: string; scheduled_for: string; landing_email_step_id: string; error_message: string | null };

// Leads viven acá (por campaña), no en Landings — una landing es solo
// el link, la campaña es la que capturó los leads. Ver
// supabase/migrations/0004_separar_campanas_de_landings.sql.
export default async function CampaignLeadsPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServiceClient();

  const [{ data: campana }, { data: pasos }, { data: leads }] = await Promise.all([
    supabase
      .from('campaigns')
      .select('id, name, status, landings(name, slug, landing_templates(name, envio_personalizado))')
      .eq('id', params.id)
      .single(),
    supabase
      .from('landing_email_steps')
      .select('id, step_number, subject')
      .eq('campaign_id', params.id)
      .order('step_number', { ascending: true }),
    supabase
      .from('leads')
      .select(
        'id, first_name, last_name, email, phone, selected_option, whatsapp_clicked_at, whatsapp_clicked_step, created_at, email_sends(id, status, scheduled_for, landing_email_step_id, error_message)'
      )
      .eq('campaign_id', params.id)
      .order('created_at', { ascending: false }),
  ]);

  const landing = campana?.landings as unknown as {
    name: string;
    slug: string;
    landing_templates: { name: string; envio_personalizado: boolean } | null;
  } | null;
  const pasosConfigurados = pasos ?? [];
  const estaActiva = campana?.status === 'active';
  // Campaña de envío personalizado (ver landing_templates.envio_personalizado
  // y app/api/leads/route.ts) — el lead elige una opción y le llega SOLO ese
  // email, no el goteo de 4. Acá se usa para mostrar qué opción eligió cada
  // uno y poder auditar contra pasosConfigurados.
  const esEnvioPersonalizado = landing?.landing_templates?.envio_personalizado ?? false;
  const numerosConfigurados = new Set(pasosConfigurados.map((p) => p.step_number));

  return (
    <div>
      <Link
        href="/admin/campaigns"
        className="rounded-one-sm text-sm font-semibold text-one-fucsia transition-colors duration-150 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-one-fucsia/40"
      >
        ← Volver a campañas
      </Link>
      <h1 className="mt-2 flex flex-wrap items-center gap-3 text-2xl font-extrabold tracking-tight text-one-oscuro">
        Leads — {campana?.name ?? '...'}
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            estaActiva ? 'bg-emerald-50 text-emerald-600' : 'bg-one-oscuro/5 text-one-oscuro/50'
          }`}
        >
          ¿Activa? {estaActiva ? 'Sí' : 'No'}
        </span>
      </h1>
      <p className="mt-1 text-sm text-one-oscuro/60">
        Landing: <span className="font-semibold text-one-oscuro">{landing ? `/${landing.slug}` : '—'}</span>
        {' · '}
        Plantilla: <span className="font-semibold text-one-oscuro">{landing?.landing_templates?.name ?? '—'}</span>
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
          <Clock className="size-3.5 text-one-dorado" strokeWidth={2.5} /> todavía no (pendiente)
        </span>
        <span className="inline-flex items-center gap-1">
          <X className="size-3.5 text-one-rojo" strokeWidth={3} /> falló
        </span>
        <span className="inline-flex items-center gap-1">
          <Minus className="size-3.5 text-one-oscuro/40" strokeWidth={3} /> no aplica para este lead
        </span>
      </div>

      <TableShell>
        <TableHead
          columns={[
            'Nombre',
            'Email',
            'Teléfono',
            'Click WhatsApp',
            ...(esEnvioPersonalizado ? ['Opción elegida'] : []),
            'Etapas de email',
            'Ingresó',
          ]}
        />
        <tbody>
            {(leads ?? []).map((lead, i) => {
              const sends = (lead.email_sends as EmailSend[]) ?? [];
              // Por cada paso CONFIGURADO en la campaña (no por cada envío
              // que exista) — así si un lead entró antes de que se agregara
              // un paso nuevo, esa etapa se ve como "no aplica" en vez de
              // faltar en silencio de la fila.
              const etapas = pasosConfigurados.map((paso) => {
                const envio = sends.find((s) => s.landing_email_step_id === paso.id);
                return {
                  numero: paso.step_number,
                  estado: envio?.status ?? 'no_aplica',
                  fecha: envio?.scheduled_for,
                  envioId: envio?.id,
                  errorMessage: envio?.error_message,
                };
              });
              return (
                <tr
                  key={lead.id}
                  style={{ '--stagger-index': i } as React.CSSProperties}
                  className="stagger-in table-row-hover border-t border-one-oscuro/5"
                >
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
                          {formatFechaHoraAR(lead.whatsapp_clicked_at)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-one-oscuro/40">Todavía no</span>
                    )}
                  </td>
                  {esEnvioPersonalizado && (
                    <td className="px-4 py-3">
                      {lead.selected_option == null ? (
                        <span className="text-one-oscuro/40">—</span>
                      ) : numerosConfigurados.has(lead.selected_option) ? (
                        <span className="text-one-oscuro">{lead.selected_option}</span>
                      ) : (
                        // El lead eligió esta opción pero nunca se cargó un
                        // email para ese step_number — no se le mandó nada
                        // y sin esta alerta quedaba invisible en el panel.
                        <span
                          title="El lead eligió esta opción, pero no hay ningún email configurado para ese número de etapa — nunca se le mandó nada."
                          className="inline-flex w-fit items-center gap-1 rounded-full bg-one-rojo/10 px-2 py-0.5 text-xs font-semibold text-one-rojo"
                        >
                          {lead.selected_option} — sin email configurado
                        </span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {etapas.map((e) => {
                        const Icono = iconoEtapa[e.estado] ?? Minus;
                        return (
                          <span key={e.numero} className="inline-flex items-center gap-1">
                            <span
                              title={`Etapa ${e.numero}: ${etiquetaEtapa[e.estado] ?? e.estado}${
                                e.fecha ? ' — ' + formatFechaHoraAR(e.fecha) : ''
                              }${e.errorMessage ? ' — ' + e.errorMessage : ''}`}
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${estiloEtapa[e.estado] ?? ''}`}
                            >
                              {e.numero}
                              <Icono className="size-3" strokeWidth={3} />
                            </span>
                            {e.estado === 'error' && e.envioId && <RetryEnvioButton envioId={e.envioId} />}
                          </span>
                        );
                      })}
                      {etapas.length === 0 && <span className="text-one-oscuro/40">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-one-oscuro/60">
                    {formatFechaHoraAR(lead.created_at)}
                  </td>
                </tr>
              );
            })}
            {(leads ?? []).length === 0 && (
              <TableEmptyRow colSpan={esEnvioPersonalizado ? 7 : 6}>Todavía no hay leads en esta campaña.</TableEmptyRow>
            )}
          </tbody>
      </TableShell>
    </div>
  );
}
