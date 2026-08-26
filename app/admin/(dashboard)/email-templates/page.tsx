import Link from 'next/link';
import { Pencil } from 'lucide-react';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { ToggleActivaButton } from './ToggleActivaButton';
import { iconActionClass, IconActionGlyph } from '../IconAction';
import { TableShell, TableHead, TableEmptyRow } from '../AdminTable';
import { formatFechaAR } from '@/lib/fecha';

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

      <TableShell>
        <TableHead columns={['Nombre', 'Estado', 'Actualizada', '']} />
        <tbody>
            {(templates ?? []).map((t) => (
              <tr key={t.id} className="table-row-hover border-t border-one-oscuro/5">
                {/* Bug real confirmado (2026-08-25) — sin truncar, un nombre
                    largo pasaba a 2 líneas y esa fila quedaba más alta que
                    el resto, descuadrando toda la tabla. */}
                <td className="px-4 py-3 font-semibold text-one-oscuro">
                  <span className="block max-w-xs truncate" title={t.name}>
                    {t.name}
                  </span>
                </td>
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
                  {formatFechaAR(t.updated_at)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/admin/email-templates/${t.id}/edit`}
                      title="Editar"
                      aria-label={`Editar ${t.name}`}
                      className={iconActionClass()}
                    >
                      <IconActionGlyph icon={Pencil} />
                    </Link>
                    <ToggleActivaButton templateId={t.id} activa={t.is_active} />
                  </div>
                </td>
              </tr>
            ))}
            {(templates ?? []).length === 0 && (
              <TableEmptyRow colSpan={4}>Todavía no hay plantillas de email creadas.</TableEmptyRow>
            )}
          </tbody>
      </TableShell>
    </div>
  );
}
