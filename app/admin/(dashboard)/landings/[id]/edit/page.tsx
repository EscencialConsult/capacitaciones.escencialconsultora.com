import { notFound } from 'next/navigation';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { LandingForm } from '../../LandingForm';
import { updateLanding } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function EditLandingPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServiceClient();

  const [{ data: landing }, { data: categorias }, { data: templates }] = await Promise.all([
    supabase
      .from('landings')
      .select('id, slug, name, category_id, template_id, is_active')
      .eq('id', params.id)
      .single(),
    supabase.from('landing_categories').select('id, name').order('name'),
    supabase.from('landing_templates').select('id, name').eq('is_active', true).order('name'),
  ]);

  if (!landing) notFound();

  const accionConId = updateLanding.bind(null, landing.id);

  return (
    <div>
      <h1 className="text-lg font-extrabold text-one-oscuro">Editar landing — {landing.name}</h1>
      <LandingForm
        action={accionConId}
        categorias={categorias ?? []}
        templates={templates ?? []}
        botonTexto="Guardar cambios"
        valoresIniciales={landing}
      />
    </div>
  );
}
