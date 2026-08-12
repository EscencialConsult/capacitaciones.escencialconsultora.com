import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { TemplateForm } from '../TemplateForm';
import { createTemplate } from '../actions';

export const dynamic = 'force-dynamic';

export default async function NewTemplatePage() {
  const supabase = createSupabaseServiceClient();
  const { data: categorias } = await supabase.from('landing_categories').select('id, name').order('name');

  return (
    <div>
      <h1 className="text-lg font-extrabold text-one-oscuro">Nueva plantilla de landing</h1>
      <TemplateForm action={createTemplate} categorias={categorias ?? []} botonTexto="Crear plantilla" />
    </div>
  );
}
