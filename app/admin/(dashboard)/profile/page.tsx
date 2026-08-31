import { headers } from 'next/headers';
import { Zap, TrendingUp, CalendarClock } from 'lucide-react';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';
import { ProfileAvatarForm } from './ProfileAvatarForm';

export const dynamic = 'force-dynamic';

const badgeEstado: Record<string, string> = {
  draft: 'bg-one-oscuro/5 text-one-oscuro/50',
  active: 'bg-emerald-50 text-emerald-600',
  paused: 'bg-one-dorado/15 text-one-dorado',
  archived: 'bg-one-oscuro/5 text-one-oscuro/40',
};
const textoEstado: Record<string, string> = {
  draft: 'Borrador',
  active: 'Activa',
  paused: 'Pausada',
  archived: 'Archivada',
};

/**
 * Barra de progreso simple — de un solo color con significado (fucsia
 * mientras hay margen, dorado/rojo cuando se acerca o pasa el límite),
 * nunca decorativa (ver DESIGN.md → anti-ia).
 */
function BarraCreditos({ usado, total }: { usado: number; total: number }) {
  const porcentaje = total > 0 ? Math.min(100, (usado / total) * 100) : 0;
  const color = porcentaje >= 100 ? 'bg-one-rojo' : porcentaje >= 80 ? 'bg-one-dorado' : 'bg-one-fucsia';
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-one-oscuro/10">
      <div className={`h-full rounded-full transition-[width] duration-500 ease-out ${color}`} style={{ width: `${porcentaje}%` }} />
    </div>
  );
}

/**
 * "Mi perfil" — ícono (2026-08-24) + créditos (2026-08-26, pedido
 * explícito: apartado al lado de la imagen de perfil, con lo consumido
 * en tiempo real y una proyección, más el detalle de campañas propias).
 *
 * En vivo = créditos ya reservados de verdad este ciclo (ver
 * credit_ledger, migración 0019 — reserva completa al registrarse cada
 * lead, no incremental por email enviado). Proyectado = una estimación
 * lineal ("a este ritmo, cuánto vas a haber gastado al cierre del
 * ciclo") a partir de días transcurridos vs. los ~30 del ciclo — un
 * aviso para planificar, no un número ya gastado.
 */
export default async function ProfilePage() {
  const email = headers().get('x-user-email');
  const avatarActual = headers().get('x-user-avatar') || undefined;

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const meta = (user?.user_metadata ?? {}) as { nombre?: string; apellido?: string };
  const nombreCompleto = [meta.nombre, meta.apellido].filter(Boolean).join(' ');

  let disponibleTotal = 0;
  let usado = 0;
  let inicioCiclo: string | null = null;
  let limiteDiario = 0;
  let usadoHoy = 0;
  let campanas: { id: string; name: string; status: string; leads: number; creditos: number }[] = [];

  if (user) {
    const admin = createSupabaseServiceClient();
    const [{ data: total }, { data: consumido }, { data: inicio }, { data: limDiario }, { data: usoHoy }, { data: campanasPropias }] = await Promise.all([
      admin.rpc('creditos_mensuales_de', { p_user_id: user.id }),
      admin.rpc('creditos_usados_ciclo_actual', { p_user_id: user.id }),
      admin.rpc('inicio_ciclo_creditos'),
      admin.rpc('limite_diario_de', { p_user_id: user.id }),
      admin.rpc('creditos_usados_hoy', { p_user_id: user.id }),
      admin.from('campaigns').select('id, name, status').eq('activated_by', user.id).order('created_at', { ascending: false }),
    ]);

    disponibleTotal = total ?? 0;
    usado = consumido ?? 0;
    inicioCiclo = inicio ?? null;
    limiteDiario = limDiario ?? 0;
    usadoHoy = usoHoy ?? 0;

    const idsPropios = (campanasPropias ?? []).map((c) => c.id);

    const [{ data: leadsReales }, { data: ledger }] =
      idsPropios.length > 0
        ? await Promise.all([
            admin.from('leads').select('campaign_id').in('campaign_id', idsPropios),
            admin.from('credit_ledger').select('campaign_id, credits').in('campaign_id', idsPropios),
          ])
        : [{ data: [] }, { data: [] }];

    const leadsPorCampana = new Map<string, number>();
    for (const l of leadsReales ?? []) {
      leadsPorCampana.set(l.campaign_id, (leadsPorCampana.get(l.campaign_id) ?? 0) + 1);
    }

    const creditosPorCampana = new Map<string, number>();
    for (const fila of ledger ?? []) {
      creditosPorCampana.set(fila.campaign_id, (creditosPorCampana.get(fila.campaign_id) ?? 0) + fila.credits);
    }

    campanas = (campanasPropias ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      leads: leadsPorCampana.get(c.id) ?? 0,
      creditos: creditosPorCampana.get(c.id) ?? 0,
    }));
  }

  const restante = Math.max(0, disponibleTotal - usado);
  const diasTranscurridos = inicioCiclo
    ? Math.max(1, Math.ceil((Date.now() - new Date(inicioCiclo).getTime()) / (24 * 60 * 60 * 1000)))
    : 1;
  const proyectado = Math.round((usado / diasTranscurridos) * 30);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-extrabold tracking-tight text-one-oscuro">Mi perfil</h1>
      <p className="mt-1 text-sm text-one-oscuro/60">{nombreCompleto || email}</p>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,320px)_1fr]">
        <div className="rounded-one-lg bg-one-blanco p-6 shadow-one-sm ring-1 ring-one-oscuro/5">
          <ProfileAvatarForm avatarActual={avatarActual} />
        </div>

        <div className="rounded-one-lg bg-one-blanco p-6 shadow-one-sm ring-1 ring-one-oscuro/5">
          <h2 className="text-sm font-bold text-one-oscuro">Créditos de envío</h2>
          <p className="mt-1 text-xs text-one-oscuro/40">
            Se reservan al registrarse cada lead en una campaña que vos activaste — no por cada email que
            efectivamente sale. Ciclo mensual (se renueva el día 25) y, en las cuentas que lo tienen
            (Brevo, Google), también un tope real por día.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-one-oscuro/50">
                <CalendarClock className="size-3.5" strokeWidth={2} />
                Hoy
              </div>
              {limiteDiario > 0 ? (
                <>
                  <p className="mt-1 text-2xl font-extrabold text-one-oscuro">
                    {usadoHoy.toLocaleString('es-AR')}
                    <span className="text-sm font-semibold text-one-oscuro/40"> / {limiteDiario.toLocaleString('es-AR')}</span>
                  </p>
                  <div className="mt-2">
                    <BarraCreditos usado={usadoHoy} total={limiteDiario} />
                  </div>
                  <p className="mt-1 text-xs text-one-oscuro/40">
                    {Math.max(0, limiteDiario - usadoHoy).toLocaleString('es-AR')} disponibles hoy
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-one-oscuro/40">Sin tope diario en tus cuentas conectadas.</p>
              )}
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-one-oscuro/50">
                <Zap className="size-3.5" strokeWidth={2} />
                En vivo (este mes)
              </div>
              <p className="mt-1 text-2xl font-extrabold text-one-oscuro">
                {usado.toLocaleString('es-AR')}
                <span className="text-sm font-semibold text-one-oscuro/40"> / {disponibleTotal.toLocaleString('es-AR')}</span>
              </p>
              <div className="mt-2">
                <BarraCreditos usado={usado} total={disponibleTotal} />
              </div>
              <p className="mt-1 text-xs text-one-oscuro/40">{restante.toLocaleString('es-AR')} disponibles</p>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-one-oscuro/50">
                <TrendingUp className="size-3.5" strokeWidth={2} />
                Proyectado a fin de ciclo
              </div>
              <p className="mt-1 text-2xl font-extrabold text-one-oscuro">{proyectado.toLocaleString('es-AR')}</p>
              <p className="mt-1 text-xs text-one-oscuro/40">
                {proyectado > disponibleTotal
                  ? 'A este ritmo, te vas a quedar sin crédito antes de que termine el ciclo.'
                  : 'A este ritmo, no deberías quedarte sin crédito este ciclo.'}
              </p>
            </div>
          </div>

          {disponibleTotal === 0 && (
            <p className="mt-4 rounded-one-sm bg-one-dorado/10 px-3 py-2 text-xs text-one-oscuro/70">
              No tenés ninguna cuenta de envío conectada — sin crédito disponible no vas a poder activar
              campañas. Conectá Brevo, Resend o Google desde Integraciones.
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-one-lg bg-one-blanco p-6 shadow-one-sm ring-1 ring-one-oscuro/5">
        <h2 className="text-sm font-bold text-one-oscuro">Tus campañas</h2>
        <p className="mt-1 text-xs text-one-oscuro/40">Las que activaste vos — desde el 25/8, cuando arrancó este conteo.</p>

        {campanas.length === 0 ? (
          <p className="mt-4 text-sm text-one-oscuro/40">Todavía no activaste ninguna campaña.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {campanas.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-one-sm bg-one-oscuro/5 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="truncate text-sm font-semibold text-one-oscuro">{c.name}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${badgeEstado[c.status] ?? ''}`}>
                    {textoEstado[c.status] ?? c.status}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-4 text-xs text-one-oscuro/50">
                  <span>{c.leads.toLocaleString('es-AR')} leads registrados</span>
                  <span>{c.creditos.toLocaleString('es-AR')} créditos consumidos</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
