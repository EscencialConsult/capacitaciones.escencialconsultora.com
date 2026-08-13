import { notFound } from 'next/navigation';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { TemplateForm } from '../../TemplateForm';
import { updateTemplate } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function EditTemplatePage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServiceClient();

  const [{ data: template }, { data: categorias }] = await Promise.all([
    supabase
      .from('landing_templates')
      .select('id, name, category_id, marca, html_content, variables_schema, is_active')
      .eq('id', params.id)
      .single(),
    supabase.from('landing_categories').select('id, name').order('name'),
  ]);

  if (!template) notFound();

  const accionConId = updateTemplate.bind(null, template.id);

  return (
    <div>
      <h1 className="text-lg font-extrabold text-one-oscuro">Editar plantilla — {template.name}</h1>
      <TemplateForm
        action={accionConId}
        categorias={categorias ?? []}
        botonTexto="Guardar cambios"
        valoresIniciales={template}
      />
    </div>
  );
}
