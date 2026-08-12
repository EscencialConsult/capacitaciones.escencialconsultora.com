import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { CampaignForm, type LandingConPlantilla } from '../CampaignForm';
import { createCampaign } from '../actions';

export const dynamic = 'force-dynamic';

export default async function NewCampaignPage() {
  const supabase = createSupabaseServiceClient();

  const [{ data: landings }, { data: emailTemplates }, { data: templates }, { data: categorias }] =
    await Promise.all([
      supabase
        .from('landings')
        .select('id, slug, name, landing_templates(name, variables_schema)')
        .order('name'),
      supabase.from('email_templates').select('id, name').eq('is_active', true).order('name'),
      supabase.from('landing_templates').select('id, name').eq('is_active', true).order('name'),
      supabase.from('landing_categories').select('id, name').order('name'),
    ]);

  return (
    <div className="max-w-3xl">
      <h1 className="text-lg font-extrabold text-one-oscuro">Nueva campaña</h1>
      <p className="mt-1 text-sm text-one-oscuro/60">
        Queda en borrador — todavía sin servir contenido. Elegí a qué landing se conecta, cargá
        todo, y cuando esté listo activala desde la lista de Campañas.
      </p>
      <CampaignForm
        landings={(landings ?? []) as unknown as LandingConPlantilla[]}
        emailTemplates={emailTemplates ?? []}
        templatesParaNuevaLanding={templates ?? []}
        categorias={categorias ?? []}
        action={createCampaign}
        botonTexto="Crear campaña"
        botonTextoPendiente="Creando..."
      />
    </div>
  );
}
