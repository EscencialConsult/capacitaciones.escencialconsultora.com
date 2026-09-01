import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { RevisarVentaCard } from './RevisarVentaCard';

export const dynamic = 'force-dynamic';

const LIMITE_PANTALLA = 50;

const ETIQUETA_SENAL: Record<string, string> = {
  email: 'Email exacto',
  telefono: 'Teléfono',
  tema_fecha_nombre: 'Tema + fecha + nombre',
};

/**
 * Cola de revisión de ventas (2026-09-01, pedido explícito: "un
 * apartado que diga Ventas... yo confirmo o deniego") — reemplaza el
 * marcado automático y silencioso de las migraciones 0034/0035. Cada
 * fila viene de app/api/ventas-sync/route.ts (el webhook que alimenta
 * esto automáticamente, ver migración 0036) con una sugerencia de a
 * qué lead/campaña corresponde — acá se confirma o se busca a mano.
 */
export default async function VentasPage() {
  const supabase = createSupabaseServiceClient();

  const [{ data: pendientes, count }, { data: confirmadasRecientes }] = await Promise.all([
    supabase
      .from('ventas')
      .select(
        `id, marca_temporal, nombre, apellido, dni, email, celular, programa, origen, monto, senales,
         lead_sugerido:leads!ventas_lead_id_sugerido_fkey(id, first_name, last_name, email, phone, created_at, campaign_id, campaigns(name, landings(name)))`,
        { count: 'exact' }
      )
      .eq('estado', 'pendiente')
      .order('marca_temporal', { ascending: false })
      .limit(LIMITE_PANTALLA),
    supabase
      .from('ventas')
      .select('id, nombre, apellido, programa, estado, revisado_en, campaign:campaigns(name)')
      .in('estado', ['confirmada', 'rechazada'])
      .order('revisado_en', { ascending: false })
      .limit(10),
  ]);

  const total = count ?? 0;

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight text-one-oscuro">Ventas</h1>
      <p className="mt-1 text-sm text-one-oscuro/60">
        {total === 0
          ? 'No hay ventas pendientes de revisar.'
          : `${total} ${total === 1 ? 'venta pendiente' : 'ventas pendientes'} de revisar${
              total > LIMITE_PANTALLA ? ` (mostrando las ${LIMITE_PANTALLA} más recientes)` : ''
            }.`}
      </p>

      <div className="mt-6 flex flex-col gap-4">
        {(pendientes ?? []).map((venta) => {
          const lead = venta.lead_sugerido as unknown as {
            id: string;
            first_name: string | null;
            last_name: string | null;
            email: string | null;
            phone: string | null;
            created_at: string;
            campaign_id: string;
            campaigns: { name: string; landings: { name: string } | null } | null;
          } | null;

          const senalesTexto = ((venta.senales as string[]) ?? []).join('_');
          const etiquetaSenal = ETIQUETA_SENAL[senalesTexto] ?? null;

          return (
            <RevisarVentaCard
              key={venta.id}
              venta={{
                id: venta.id,
                marcaTemporal: venta.marca_temporal,
                nombre: venta.nombre,
                apellido: venta.apellido,
                dni: venta.dni,
                email: venta.email,
                celular: venta.celular,
                programa: venta.programa,
                origen: venta.origen,
                monto: venta.monto,
              }}
              leadSugerido={
                lead
                  ? {
                      id: lead.id,
                      nombre: lead.first_name,
                      apellido: lead.last_name,
                      email: lead.email,
                      telefono: lead.phone,
                      campaignId: lead.campaign_id,
                      campania: lead.campaigns?.name ?? '—',
                      landing: lead.campaigns?.landings?.name ?? null,
                      ingreso: lead.created_at,
                    }
                  : null
              }
              etiquetaSenal={etiquetaSenal}
            />
          );
        })}

        {(pendientes ?? []).length === 0 && (
          <div className="rounded-one-lg border border-one-oscuro/10 bg-one-blanco/60 px-6 py-10 text-center text-sm text-one-oscuro/50">
            Nada pendiente por ahora — cuando lleguen ventas nuevas del sync automático, van a aparecer acá.
          </div>
        )}
      </div>

      {(confirmadasRecientes ?? []).length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-bold text-one-oscuro/70">Revisadas hace poco</h2>
          <div className="mt-3 flex flex-col gap-1.5">
            {(confirmadasRecientes ?? []).map((v) => {
              const camp = v.campaign as unknown as { name: string } | null;
              return (
                <div
                  key={v.id}
                  className="flex items-center gap-3 rounded-one-sm border border-one-oscuro/5 bg-one-blanco/40 px-4 py-2 text-xs text-one-oscuro/60"
                >
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 font-semibold ${
                      v.estado === 'confirmada' ? 'bg-emerald-50 text-emerald-600' : 'bg-one-oscuro/5 text-one-oscuro/40'
                    }`}
                  >
                    {v.estado === 'confirmada' ? 'Confirmada' : 'Rechazada'}
                  </span>
                  <span className="text-one-oscuro">
                    {v.nombre} {v.apellido}
                  </span>
                  {v.programa && <span className="text-one-oscuro/40">— {v.programa}</span>}
                  {camp && <span className="ml-auto text-one-oscuro/40">{camp.name}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
