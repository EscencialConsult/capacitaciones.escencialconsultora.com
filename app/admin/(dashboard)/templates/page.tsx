import Link from 'next/link';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { ToggleActivaButton } from './ToggleActivaButton';

export const dynamic = 'force-dynamic';

export default async function TemplatesPage() {
  const supabase = createSupabaseServiceClient();

  const { data: templates } = await supabase
    .from('landing_templates')
    .select('id, name, is_active, updated_at, landing_categories(name), landings(count)')
    .order('updated_at', { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">Plantillas de landing</h1>
        <Link
          href="/admin/templates/new"
          prefetch={false}
          className="rounded-lg bg-azul px-4 py-2 text-sm font-semibold text-white hover:bg-azul-oscuro"
        >
          + Nueva plantilla
        </Link>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Categoría</th>
              <th className="px-4 py-3 font-medium">Landings usándola</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Actualizada</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {(templates ?? []).map((t) => {
              const categoria = t.landing_categories as unknown as { name: string } | null;
              const usoCount = (t.landings as unknown as { count: number }[])?.[0]?.count ?? 0;
              return (
                <tr key={t.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-800">{t.name}</td>
                  <td className="px-4 py-3 text-slate-500">{categoria?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{usoCount}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        t.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {t.is_active ? 'activa' : 'inactiva'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(t.updated_at).toLocaleDateString('es-AR')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Link href={`/admin/templates/${t.id}/edit`} prefetch={false} className="text-azul hover:underline">
                        Editar
                      </Link>
                      <ToggleActivaButton templateId={t.id} activa={t.is_active} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {(templates ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Todavía no hay plantillas de landing creadas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
