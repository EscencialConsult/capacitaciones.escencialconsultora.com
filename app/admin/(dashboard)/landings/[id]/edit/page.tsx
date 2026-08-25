import { notFound } from 'next/navigation';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { LandingForm } from '../../LandingForm';
import { updateLanding } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function EditLandingPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServiceClient();

  const [{ data: landing }, { data: templates }] = await Promise.all([
    supabase
      .from('landings')
      .select('id, slug, name, template_id, is_active, is_test')
      .eq('id', params.id)
      .single(),
    supabase.from('landing_templates').select('id, name, envio_personalizado').eq('is_active', true).order('name'),
  ]);

  if (!landing) notFound();

  // Si la plantilla que esta landing ya tiene asignada fue desactivada
  // después (templates/page.tsx lo permite con un solo click aunque
  // tenga landings usándola), el filtro is_active=true de arriba la deja
  // afuera de las opciones del <select> — el navegador cae solo en la
  // primera plantilla activa del DOM, y si Facundo guarda esta pantalla
  // sin notar/tocar el combo de Plantilla, la landing pasa a servir en
  // silencio el HTML/variables de otra plantilla. Por eso la agregamos a
  // mano acá si hace falta, aunque esté inactiva.
  let templatesParaForm = templates ?? [];
  if (landing.template_id && !templatesParaForm.some((t) => t.id === landing.template_id)) {
    const { data: plantillaActual } = await supabase
      .from('landing_templates')
      .select('id, name, envio_personalizado')
      .eq('id', landing.template_id)
      .single();
    if (plantillaActual) {
      templatesParaForm = [
        ...templatesParaForm,
        { ...plantillaActual, name: `${plantillaActual.name} (inactiva)` },
      ];
    }
  }

  const accionConId = updateLanding.bind(null, landing.id);

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight text-one-oscuro">Editar landing — {landing.name}</h1>
      <LandingForm
        key={landing.id}
        action={accionConId}
        templates={templatesParaForm}
        botonTexto="Guardar cambios"
        valoresIniciales={landing}
      />
    </div>
  );
}
