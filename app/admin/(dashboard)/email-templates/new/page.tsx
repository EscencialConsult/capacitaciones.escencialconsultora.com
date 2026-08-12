import { EmailTemplateForm } from '../EmailTemplateForm';
import { createEmailTemplate } from '../actions';

export default function NewEmailTemplatePage() {
  return (
    <div>
      <h1 className="text-lg font-extrabold text-one-oscuro">Nueva plantilla de email</h1>
      <EmailTemplateForm action={createEmailTemplate} botonTexto="Crear plantilla" />
    </div>
  );
}
