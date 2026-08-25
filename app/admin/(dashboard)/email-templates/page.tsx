import Link from 'next/link';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { ToggleActivaButton } from './ToggleActivaButton';

export const dynamic = 'force-dynamic';

export default async function EmailTemplatesPage() {
  const supabase = createSupabaseServiceClient();
  const { data: templates } = await supabase
    .from('email_templates')
    .select('id, name, is_active, updated_at')
    .order('updated_at', { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-one-oscuro">Plantillas de email</h1>
        <Link
          href="/admin/email-templates/new"
          className="rounded-full bg-one-fucsia px-6 py-2.5 text-sm font-bold text-one-negro transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-one-fucsia"
        >
          + Nueva plantilla
        </Link>
      </div>

      <div className="mt-6 overflow-hidden rounded-one-lg bg-one-blanco shadow-one-sm ring-1 ring-one-oscuro/5">
        <table className="w-full text-sm">
          <thead className="text-left text-xs font-semibold tracking-wide text-one-oscuro/50 uppercase">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Actualizada</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(templates ?? []).map((t) => (
              <tr key={t.id} className="table-row-hover border-t border-one-oscuro/5">
                <td className="px-4 py-3 font-semibold text-one-oscuro">{t.name}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      t.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-one-oscuro/5 text-one-oscuro/50'
                    }`}
                  >
                    {t.is_active ? 'activa' : 'inactiva'}
                  </span>
                </td>
                <td className="px-4 py-3 text-one-oscuro/60">
                  {new Date(t.updated_at).toLocaleDateString('es-AR')}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/admin/email-templates/${t.id}/edit`}
                      className="text-sm font-semibold text-one-oscuro/70 transition-colors duration-150 hover:text-one-fucsia"
                    >
                      Editar
                    </Link>
                    <ToggleActivaButton templateId={t.id} activa={t.is_active} />
                  </div>
                </td>
              </tr>
            ))}
            {(templates ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-one-oscuro/40">
                  Todavía no hay plantillas de email creadas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
