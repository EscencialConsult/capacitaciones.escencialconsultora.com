import { TemplateForm } from '../TemplateForm';
import { createTemplate } from '../actions';
import { obtenerMarcasPersonalizadas } from '@/lib/marcas-personalizadas';

export const dynamic = 'force-dynamic';

export default async function NewTemplatePage({
  searchParams,
}: {
  searchParams: { tipo?: string };
}) {
  const marcasPersonalizadas = await obtenerMarcasPersonalizadas();

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight text-one-oscuro">Nueva plantilla de landing</h1>
      <TemplateForm
        key="new"
        action={createTemplate}
        botonTexto="Crear plantilla"
        envioPersonalizadoPorDefecto={searchParams.tipo === 'personalizado'}
        marcasPersonalizadas={marcasPersonalizadas}
      />
    </div>
  );
}
