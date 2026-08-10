import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CategoryForm } from './CategoryForm';
import { DeleteCategoryButton } from './DeleteCategoryButton';

export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
  const supabase = createSupabaseServerClient();
  const { data: categorias } = await supabase
    .from('landing_categories')
    .select('id, name, slug, landing_templates(count)')
    .order('name');

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-800">Categorías de landing</h1>
      <p className="mt-1 text-sm text-slate-500">
        Se usan para organizar las plantillas (ej. "Servicios", "Capacitaciones"). Se pueden agregar las
        que hagan falta, sin límite.
      </p>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <CategoryForm />
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Plantillas</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {(categorias ?? []).map((c) => {
              const usoCount = (c.landing_templates as unknown as { count: number }[])?.[0]?.count ?? 0;
              return (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                  <td className="px-4 py-3 text-slate-500">{c.slug}</td>
                  <td className="px-4 py-3 text-slate-500">{usoCount}</td>
                  <td className="px-4 py-3">
                    <DeleteCategoryButton categoryId={c.id} />
                  </td>
                </tr>
              );
            })}
            {(categorias ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  Todavía no hay categorías.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
