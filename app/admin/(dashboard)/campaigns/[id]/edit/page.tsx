import { notFound, redirect } from 'next/navigation';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { CampaignForm } from '../../CampaignForm';
import { updateLanding } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function EditCampaignPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServiceClient();

  const [{ data: landing }, { data: pasos }, { data: templates }, { data: emailTemplates }] =
    await Promise.all([
      supabase
        .from('landings')
        .select('id, slug, name, template_id, status, advisor_name, whatsapp_number, whatsapp_message, variables')
        .eq('id', params.id)
        .single(),
      supabase
        .from('landing_email_steps')
        .select('step_number, email_template_id, offset_days, subject, content')
        .eq('landing_id', params.id)
        .order('step_number', { ascending: true }),
      supabase.from('landing_templates').select('id, name').eq('is_active', true).order('name'),
      supabase.from('email_templates').select('id, name').eq('is_active', true).order('name'),
    ]);

  if (!landing) notFound();

  // Ya se activó — no hay nada que editar acá, la pantalla de esta
  // landing ahora es la de analytics (/admin/landings), no este form.
  if (landing.status !== 'draft') {
    redirect(`/admin/landings/${landing.id}/leads`);
  }

  const accionConId = updateLanding.bind(null, landing.id);

  return (
    <div className="max-w-3xl">
      <h1 className="text-lg font-extrabold text-one-oscuro">Editar campaña — {landing.name}</h1>
      <CampaignForm
        templates={templates ?? []}
        emailTemplates={emailTemplates ?? []}
        action={accionConId}
        botonTexto="Guardar cambios"
        botonTextoPendiente="Guardando..."
        valoresIniciales={{
          slug: landing.slug,
          name: landing.name,
          template_id: landing.template_id,
          advisor_name: landing.advisor_name,
          whatsapp_number: landing.whatsapp_number,
          whatsapp_message: landing.whatsapp_message,
          variables: landing.variables as { titulo?: string; subtitulo?: string; boton_texto?: string } | null,
          pasos: pasos ?? [],
        }}
      />
    </div>
  );
}
