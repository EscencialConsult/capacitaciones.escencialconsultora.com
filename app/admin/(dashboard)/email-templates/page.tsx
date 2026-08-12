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
        <h1 className="text-lg font-extrabold text-one-oscuro">Plantillas de email</h1>
        <Link
          href="/admin/email-templates/new"
          prefetch={false}
          className="rounded-full bg-one-fucsia px-6 py-2.5 text-sm font-bold text-one-negro transition-all duration-300 hover:-translate-y-0.5"
        >
          + Nueva plantilla
        </Link>
      </div>

      <div className="mt-6 overflow-hidden rounded-one-lg bg-one-oscuro/5">
        <table className="w-full text-sm">
          <thead className="text-left text-one-oscuro/50">
            <tr>
              <th className="px-4 py-3 font-semibold">Nombre</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Actualizada</th>
              <th className="px-4 py-3 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {(templates ?? []).map((t) => (
              <tr key={t.id} className="border-t border-one-oscuro/5">
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
                      prefetch={false}
                      className="text-one-fucsia hover:underline"
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
