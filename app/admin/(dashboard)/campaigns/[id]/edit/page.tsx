import { notFound, redirect } from 'next/navigation';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { CampaignForm, type LandingConPlantilla } from '../../CampaignForm';
import { updateCampaign } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function EditCampaignPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServiceClient();

  const [{ data: campana }, { data: pasos }, { data: landings }, { data: emailTemplates }, { data: templates }, { data: categorias }] =
    await Promise.all([
      supabase
        .from('campaigns')
        .select('id, name, landing_id, status, advisor_name, whatsapp_number, whatsapp_message, variables')
        .eq('id', params.id)
        .single(),
      supabase
        .from('landing_email_steps')
        .select('step_number, email_template_id, offset_days, subject, content')
        .eq('campaign_id', params.id)
        .order('step_number', { ascending: true }),
      supabase
        .from('landings')
        .select('id, slug, name, landing_templates(name, variables_schema)')
        .order('name'),
      supabase.from('email_templates').select('id, name').eq('is_active', true).order('name'),
      supabase.from('landing_templates').select('id, name').eq('is_active', true).order('name'),
      supabase.from('landing_categories').select('id, name').order('name'),
    ]);

  if (!campana) notFound();

  // Ya se activó — no hay nada que editar acá, la pantalla de esta
  // campaña ahora es la de leads/analytics, no este form.
  if (campana.status !== 'draft') {
    redirect(`/admin/campaigns/${campana.id}/leads`);
  }

  const accionConId = updateCampaign.bind(null, campana.id);

  return (
    <div className="max-w-3xl">
      <h1 className="text-lg font-extrabold text-one-oscuro">Editar campaña — {campana.name}</h1>
      <CampaignForm
        landings={(landings ?? []) as unknown as LandingConPlantilla[]}
        emailTemplates={emailTemplates ?? []}
        templatesParaNuevaLanding={templates ?? []}
        categorias={categorias ?? []}
        action={accionConId}
        botonTexto="Guardar cambios"
        botonTextoPendiente="Guardando..."
        valoresIniciales={{
          name: campana.name,
          landing_id: campana.landing_id,
          advisor_name: campana.advisor_name,
          whatsapp_number: campana.whatsapp_number,
          whatsapp_message: campana.whatsapp_message,
          variables: (campana.variables as Record<string, string> | null) ?? {},
          pasos: pasos ?? [],
        }}
      />
    </div>
  );
}
