import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { EmailTemplateForm } from '../../EmailTemplateForm';
import { updateEmailTemplate } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function EditEmailTemplatePage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: template } = await supabase
    .from('email_templates')
    .select('id, name, html_content, is_active')
    .eq('id', params.id)
    .single();

  if (!template) notFound();

  const accionConId = updateEmailTemplate.bind(null, template.id);

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-800">Editar plantilla — {template.name}</h1>
      <EmailTemplateForm action={accionConId} botonTexto="Guardar cambios" valoresIniciales={template} />
    </div>
  );
}
