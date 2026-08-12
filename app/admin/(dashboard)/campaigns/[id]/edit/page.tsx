import { notFound } from 'next/navigation';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { CampaignForm, type LandingConPlantilla } from '../../CampaignForm';
import { updateCampaign } from '../../actions';

export const dynamic = 'force-dynamic';

const textoEstado: Record<string, string> = {
  draft: 'en borrador',
  active: 'activa',
  paused: 'pausada',
  archived: 'archivada',
};

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

  const accionConId = updateCampaign.bind(null, campana.id);

  return (
    <div className="max-w-3xl">
      <h1 className="text-lg font-extrabold text-one-oscuro">Editar campaña — {campana.name}</h1>
      {campana.status !== 'draft' && (
        <p className="mt-2 rounded-one-sm bg-one-dorado/10 px-3 py-2 text-sm text-one-oscuro/70">
          Esta campaña está <strong>{textoEstado[campana.status] ?? campana.status}</strong> — los
          cambios que guardes acá impactan de inmediato en su link público. Si un lead ya recibió
          el email de algún paso, ese paso no se puede vaciar (sí se puede editar su texto).
        </p>
      )}
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
