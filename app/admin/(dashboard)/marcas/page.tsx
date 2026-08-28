import Link from 'next/link';
import Image from 'next/image';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { TableShell, TableHead, TableEmptyRow } from '../AdminTable';
import { DeleteButton } from '../DeleteButton';
import { MARCAS, type Marca } from '@/lib/landing-template-defaults';
import { eliminarMarcaPersonalizada } from './actions';

export const dynamic = 'force-dynamic';

/**
 * Kit de marca editable (2026-08-28, pedido explícito) — lista las
 * marcas creadas desde el panel (marcas_personalizadas) DEBAJO de las 4
 * fijas del sistema (MARCAS hardcodeada, ver lib/landing-template-defaults.ts),
 * mostradas acá solo de referencia — esas no se crean ni se editan
 * desde acá, siguen siendo código.
 */
export default async function MarcasPage() {
  const supabase = createSupabaseServiceClient();
  const { data: marcas } = await supabase
    .from('marcas_personalizadas')
    .select('id, nombre, colores, logo_isotipo, created_at, landing_templates(count)')
    .order('created_at', { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-one-oscuro">Marcas</h1>
          <p className="mt-1 text-sm text-one-oscuro/60">
            Colores, tipografía y logos de cada marca — se cargan una sola vez acá y quedan
            conectados solos al prompt automático de Plantillas.
          </p>
        </div>
        <Link
          href="/admin/marcas/new"
          className="rounded-full bg-one-fucsia px-6 py-2.5 text-sm font-bold text-one-negro transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-one-fucsia"
        >
          + Nueva marca
        </Link>
      </div>

      <h2 className="mt-8 text-sm font-bold tracking-wide text-one-oscuro/50 uppercase">Marcas fijas del sistema</h2>
      <p className="mt-1 text-xs text-one-oscuro/40">
        Identidad ya resuelta en código — no se editan desde acá, contactá a soporte técnico si hace
        falta cambiar alguna.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        {(Object.keys(MARCAS) as Marca[]).map((m) => (
          <div
            key={m}
            className="flex items-center gap-2.5 rounded-full border border-one-oscuro/10 bg-one-blanco py-1.5 pr-4 pl-1.5"
          >
            <Image
              src={MARCAS[m].logos.isotipo}
              alt={MARCAS[m].nombre}
              width={28}
              height={28}
              className="size-7 shrink-0 rounded-full object-cover"
            />
            <span className="text-sm font-semibold text-one-oscuro">{MARCAS[m].nombre}</span>
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-sm font-bold tracking-wide text-one-oscuro/50 uppercase">Tus marcas</h2>
      <TableShell>
        <TableHead columns={['Marca', 'Colores', 'Plantillas usándola', 'Creada', '']} />
        <tbody>
          {(marcas ?? []).map((m) => {
            const usoCount = (m.landing_templates as unknown as { count: number }[])?.[0]?.count ?? 0;
            return (
              <tr key={m.id} className="table-row-hover border-t border-one-oscuro/5">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element -- URL pública de Storage, fuera de /public */}
                    <img
                      src={m.logo_isotipo}
                      alt={m.nombre}
                      className="size-10 shrink-0 rounded-full bg-one-oscuro/5 object-contain ring-1 ring-one-oscuro/10"
                    />
                    <span className="font-semibold text-one-oscuro">{m.nombre}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {((m.colores as string[] | null) ?? []).slice(0, 6).map((c) => (
                      <span
                        key={c}
                        title={c}
                        className="size-4 shrink-0 rounded-full border border-one-oscuro/10"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-one-oscuro/60">{usoCount}</td>
                <td className="px-4 py-3 text-one-oscuro/60">
                  {new Date(m.created_at).toLocaleDateString('es-AR')}
                </td>
                <td className="px-4 py-3">
                  <DeleteButton itemLabel={`la marca "${m.nombre}"`} onDelete={eliminarMarcaPersonalizada.bind(null, m.id)} />
                </td>
              </tr>
            );
          })}
          {(marcas ?? []).length === 0 && (
            <TableEmptyRow colSpan={5}>Todavía no creaste ninguna marca propia.</TableEmptyRow>
          )}
        </tbody>
      </TableShell>
    </div>
  );
}
