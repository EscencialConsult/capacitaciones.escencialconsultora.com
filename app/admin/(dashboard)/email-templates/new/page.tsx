import { EmailTemplateForm } from '../EmailTemplateForm';
import { createEmailTemplate } from '../actions';

export default function NewEmailTemplatePage() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight text-one-oscuro">Nueva plantilla de email</h1>
      <EmailTemplateForm action={createEmailTemplate} botonTexto="Crear plantilla" />
    </div>
  );
}
