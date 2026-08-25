import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { LandingForm } from '../LandingForm';
import { createLanding } from '../actions';

export const dynamic = 'force-dynamic';

export default async function NewLandingPage() {
  const supabase = createSupabaseServiceClient();

  const { data: templates } = await supabase
    .from('landing_templates')
    .select('id, name, envio_personalizado')
    .eq('is_active', true)
    .order('name');

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight text-one-oscuro">Nueva landing</h1>
      <LandingForm key="new" action={createLanding} templates={templates ?? []} botonTexto="Crear landing" />
    </div>
  );
}
