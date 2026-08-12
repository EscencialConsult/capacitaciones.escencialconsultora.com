import Link from 'next/link';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { ActivateButton } from './ActivateButton';

export const dynamic = 'force-dynamic';

// Acá viven las campañas TODAVÍA sin publicar (status='draft') — se
// arma acá toda la data (asesora, WhatsApp, los 4 emails, qué diseño
// usa) antes de que exista un link público. Una vez que se activa, la
// fila desaparece de esta lista y pasa a /admin/landings.
export default async function CampaignsPage() {
  const supabase = createSupabaseServiceClient();

  const { data: campanas } = await supabase
    .from('landings')
    .select('id, slug, name, landing_templates(name), landing_email_steps(count)')
    .eq('status', 'draft')
    .order('created_at', { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-extrabold text-one-oscuro">Campañas</h1>
          <p className="mt-1 text-sm text-one-oscuro/60">
            Borradores — todavía sin link público. Armá acá el diseño, la asesora y los emails; cuando
            esté listo, activala para que se convierta en landing.
          </p>
        </div>
        <Link
          href="/admin/campaigns/new"
          prefetch={false}
          className="rounded-full bg-one-fucsia px-6 py-2.5 text-sm font-bold text-one-negro transition-all duration-300 hover:-translate-y-0.5"
        >
          + Nueva campaña
        </Link>
      </div>

      <div className="mt-6 overflow-hidden rounded-one-lg bg-one-oscuro/5">
        <table className="w-full text-sm">
          <thead className="text-left text-one-oscuro/50">
            <tr>
              <th className="px-4 py-3 font-semibold">Nombre</th>
              <th className="px-4 py-3 font-semibold">Link (a futuro)</th>
              <th className="px-4 py-3 font-semibold">Plantilla</th>
              <th className="px-4 py-3 font-semibold">Emails cargados</th>
              <th className="px-4 py-3 font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {(campanas ?? []).map((c) => {
              const template = c.landing_templates as unknown as { name: string } | null;
              const cantidadEmails = (c.landing_email_steps as unknown as { count: number }[])?.[0]?.count ?? 0;
              return (
                <tr key={c.id} className="border-t border-one-oscuro/5">
                  <td className="px-4 py-3 text-one-oscuro">{c.name}</td>
                  <td className="px-4 py-3 text-one-oscuro/50">/{c.slug}</td>
                  <td className="px-4 py-3 text-one-oscuro/60">{template?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-one-oscuro/60">{cantidadEmails}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/admin/campaigns/${c.id}/edit`}
                        prefetch={false}
                        className="text-one-fucsia hover:underline"
                      >
                        Editar
                      </Link>
                      <ActivateButton landingId={c.id} slug={c.slug} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {(campanas ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-one-oscuro/40">
                  No hay campañas en borrador. Creá una nueva para arrancar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
