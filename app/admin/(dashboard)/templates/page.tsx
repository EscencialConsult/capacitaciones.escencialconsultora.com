import Link from 'next/link';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { ToggleActivaButton } from './ToggleActivaButton';
import { deleteTemplate } from './actions';
import { DeleteButton } from '../DeleteButton';
import { MARCAS, type Marca } from '@/lib/landing-template-defaults';

export const dynamic = 'force-dynamic';

// Dos pestañas separadas (2026-08-24, pedido de Facundo) — las
// plantillas de "envío personalizado" (el lead elige una opción y se le
// manda un solo email al instante, ver landing_templates.envio_personalizado)
// son un tipo de campaña distinto a las de goteo normal por días, así
// que se listan aparte para no mezclarlas — misma tabla, mismo query
// base, solo cambia el filtro según `?tipo`.
export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: { tipo?: string };
}) {
  const personalizado = searchParams.tipo === 'personalizado';
  const supabase = createSupabaseServiceClient();

  const { data: templates } = await supabase
    .from('landing_templates')
    .select('id, name, marca, is_active, updated_at, envio_personalizado, landings(count)')
    .eq('envio_personalizado', personalizado)
    .order('updated_at', { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-one-oscuro">Plantillas de landing</h1>
        <Link
          href={personalizado ? '/admin/templates/new?tipo=personalizado' : '/admin/templates/new'}
          className="rounded-full bg-one-fucsia px-6 py-2.5 text-sm font-bold text-one-negro transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-one-fucsia"
        >
          + Nueva plantilla
        </Link>
      </div>

      {/* Selector de pestañas — estado activo con tinte fucsia/15 (mismo
          criterio que el ítem activo del sidebar en DESIGN.md), nunca
          sólido: el sólido queda reservado para el único CTA real de la
          pantalla ("+ Nueva plantilla"), ver La Regla de la Rareza Fucsia. */}
      <div className="mt-6 flex gap-2">
        <Link
          href="/admin/templates"
          className={`rounded-full px-4 py-2 text-sm font-bold transition-colors duration-200 ease-out ${
            !personalizado ? 'bg-one-fucsia/15 text-one-fucsia' : 'bg-one-oscuro/5 text-one-oscuro/60 hover:bg-one-oscuro/10'
          }`}
        >
          Plantillas
        </Link>
        <Link
          href="/admin/templates?tipo=personalizado"
          className={`rounded-full px-4 py-2 text-sm font-bold transition-colors duration-200 ease-out ${
            personalizado ? 'bg-one-fucsia/15 text-one-fucsia' : 'bg-one-oscuro/5 text-one-oscuro/60 hover:bg-one-oscuro/10'
          }`}
        >
          Envío personalizado
        </Link>
      </div>
      {personalizado && (
        <p className="mt-2 text-xs text-one-oscuro/40">
          El lead elige una opción al registrarse (1 a 4) y recibe un solo email al instante — el
          que corresponde a esa opción, en vez del goteo normal de días.
        </p>
      )}

      <div className="mt-6 overflow-hidden rounded-one-lg bg-one-blanco shadow-one-sm ring-1 ring-one-oscuro/5">
        <table className="w-full text-sm">
          <thead className="text-left text-xs font-semibold tracking-wide text-one-oscuro/50 uppercase">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Marca</th>
              <th className="px-4 py-3">Landings usándola</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Actualizada</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(templates ?? []).map((t) => {
              const usoCount = (t.landings as unknown as { count: number }[])?.[0]?.count ?? 0;
              return (
                <tr key={t.id} className="table-row-hover border-t border-one-oscuro/5">
                  <td className="px-4 py-3 font-semibold text-one-oscuro">{t.name}</td>
                  <td className="px-4 py-3 text-one-oscuro/60">
                    {t.marca ? MARCAS[t.marca as Marca]?.nombre ?? t.marca : '—'}
                  </td>
                  <td className="px-4 py-3 text-one-oscuro/60">{usoCount}</td>
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
                        href={`/admin/templates/${t.id}/edit`}
                        className="text-sm font-semibold text-one-oscuro/70 transition-colors duration-150 hover:text-one-fucsia"
                      >
                        Editar
                      </Link>
                      <ToggleActivaButton templateId={t.id} activa={t.is_active} />
                      <DeleteButton itemLabel={`la plantilla "${t.name}"`} onDelete={deleteTemplate.bind(null, t.id)} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {(templates ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-one-oscuro/40">
                  {personalizado
                    ? 'Todavía no hay plantillas de envío personalizado creadas.'
                    : 'Todavía no hay plantillas de landing creadas.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
