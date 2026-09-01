import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { VentasTabs } from '../VentasTabs';
import { ListaVentasPendientes } from './ListaVentasPendientes';

export const dynamic = 'force-dynamic';

const LIMITE_PANTALLA = 50;

/**
 * Cola de revisión de ventas (2026-09-01, ver migración 0036) — lista
 * compacta, clic en una fila abre el panel de detalle (2026-09-01,
 * pedido explícito viendo la interfaz real: "aparece como los usuarios
 * coincidencias... yo clico en uno de ellos y se me abre como un
 * panel"). Solo trae 'pendiente' (con sugerencia real) — las que no
 * matchean ningún lead quedan aparte como 'sin_coincidencia' (ver
 * migración 0038) y no aparecen acá; las ya revisadas se ven en
 * /admin/ventas (analítica), no en esta cola.
 */
export default async function RevisarVentasPage() {
  const supabase = createSupabaseServiceClient();

  const { data: pendientes, count } = await supabase
    .from('ventas')
    .select(
      `id, marca_temporal, nombre, apellido, dni, email, celular, programa, origen, monto, senales,
       lead_sugerido:leads!ventas_lead_id_sugerido_fkey(id, first_name, last_name, email, phone, created_at, campaign_id, campaigns(name, landings(name)))`,
      { count: 'exact' }
    )
    .eq('estado', 'pendiente')
    .order('marca_temporal', { ascending: false })
    .limit(LIMITE_PANTALLA);

  const total = count ?? 0;

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight text-one-oscuro">Ventas</h1>
      <VentasTabs />

      <p className="mt-5 text-sm text-one-oscuro/60">
        {total === 0
          ? 'No hay ventas con coincidencias pendientes de revisar.'
          : `${total} ${total === 1 ? 'coincidencia pendiente' : 'coincidencias pendientes'} de revisar${
              total > LIMITE_PANTALLA ? ` (mostrando las ${LIMITE_PANTALLA} más recientes)` : ''
            }.`}
      </p>

      <ListaVentasPendientes pendientes={pendientes ?? []} />
    </div>
  );
}
