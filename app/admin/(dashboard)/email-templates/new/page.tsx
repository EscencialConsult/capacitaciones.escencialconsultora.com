import { EmailTemplateForm } from '../EmailTemplateForm';
import { createEmailTemplate } from '../actions';

export default function NewEmailTemplatePage() {
  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-800">Nueva plantilla de email</h1>
      <EmailTemplateForm action={createEmailTemplate} botonTexto="Crear plantilla" />
    </div>
  );
}
