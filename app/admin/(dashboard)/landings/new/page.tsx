import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { LandingForm } from '../LandingForm';
import { createLanding } from '../actions';

export const dynamic = 'force-dynamic';

export default async function NewLandingPage() {
  const supabase = createSupabaseServiceClient();

  const [{ data: categorias }, { data: templates }] = await Promise.all([
    supabase.from('landing_categories').select('id, name').order('name'),
    supabase.from('landing_templates').select('id, name').eq('is_active', true).order('name'),
  ]);

  return (
    <div>
      <h1 className="text-lg font-extrabold text-one-oscuro">Nueva landing</h1>
      <LandingForm
        action={createLanding}
        categorias={categorias ?? []}
        templates={templates ?? []}
        botonTexto="Crear landing"
      />
    </div>
  );
}
