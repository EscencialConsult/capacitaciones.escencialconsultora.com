import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { CampaignForm } from '../CampaignForm';
import { createLanding } from '../actions';

export const dynamic = 'force-dynamic';

export default async function NewCampaignPage() {
  const supabase = createSupabaseServiceClient();

  const [{ data: templates }, { data: emailTemplates }] = await Promise.all([
    supabase
      .from('landing_templates')
      .select('id, name, variables_schema')
      .eq('is_active', true)
      .order('name'),
    supabase.from('email_templates').select('id, name').eq('is_active', true).order('name'),
  ]);

  return (
    <div className="max-w-3xl">
      <h1 className="text-lg font-extrabold text-one-oscuro">Nueva campaña</h1>
      <p className="mt-1 text-sm text-one-oscuro/60">
        Queda en borrador — todavía sin link público. Cuando esté todo cargado, activala desde la lista
        de Campañas para que se convierta en landing de verdad.
      </p>
      <CampaignForm
        templates={templates ?? []}
        emailTemplates={emailTemplates ?? []}
        action={createLanding}
        botonTexto="Crear campaña"
        botonTextoPendiente="Creando..."
      />
    </div>
  );
}
