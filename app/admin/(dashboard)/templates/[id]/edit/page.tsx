import { notFound } from 'next/navigation';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { TemplateForm } from '../../TemplateForm';
import { updateTemplate, contarCampanasConectadas } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function EditTemplatePage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServiceClient();

  const { data: template } = await supabase
    .from('landing_templates')
    .select('id, name, marca, html_content, variables_schema, is_active, envio_personalizado, updated_at')
    .eq('id', params.id)
    .single();

  if (!template) notFound();

  const accionConId = updateTemplate.bind(null, template.id);
  const campanasConectadas = await contarCampanasConectadas(template.id);

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight text-one-oscuro">Editar plantilla — {template.name}</h1>
      <TemplateForm
        key={template.id}
        action={accionConId}
        botonTexto="Guardar cambios"
        valoresIniciales={template}
        campanasConectadas={campanasConectadas}
      />
    </div>
  );
}
