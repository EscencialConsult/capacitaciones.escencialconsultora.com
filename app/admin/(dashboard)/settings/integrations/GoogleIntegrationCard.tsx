import { Clock, CheckCircle2 } from 'lucide-react';

/**
 * Google como 3er proveedor de envío (2026-08-31) — simplificado a
 * propósito (pedido explícito: "hagamos una interfaz superadmin... para
 * que sea lo más sencillo para los admins"). La config de Google Cloud
 * (Client ID/Secret) vive en /admin/superadmin, gateada por
 * esSuperAdmin — ver ese archivo, no acá. Un admin de a pie nunca
 * necesita enterarse de que existe Google Cloud Console; esta tarjeta
 * solo refleja SI ya está listo para usarse.
 *
 * El botón real de "Conectar con Google" (OAuth por admin) todavía no
 * está construido — llega en el próximo paso, una vez que haya un
 * Client ID/Secret real para poder probarlo de punta a punta (mismo
 * criterio que el resto de las integraciones de este proyecto: nunca
 * se construye contra una API sin poder probarla con datos reales).
 */
export function GoogleIntegrationCard({ configuradoAlgunavez }: { configuradoAlgunavez: boolean }) {
  return (
    <div className="rounded-one-lg border border-one-oscuro/10 bg-one-blanco p-6 shadow-one-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-one-oscuro">Google</h2>
          {configuradoAlgunavez ? (
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">
              <CheckCircle2 className="size-3.5" /> Disponible próximamente
            </span>
          ) : (
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-one-oscuro/5 px-2.5 py-1 text-xs font-semibold text-one-oscuro/50">
              <Clock className="size-3.5" /> Todavía no disponible
            </span>
          )}
        </div>
      </div>

      <p className="mt-5 text-sm text-one-oscuro/70">
        {configuradoAlgunavez
          ? 'Vas a poder vincular tu cuenta de Gmail con un click, sin pegar ninguna clave — el botón de conectar se habilita en el próximo paso.'
          : 'Todavía no está configurado a nivel plataforma — pedile a un superadmin que lo active desde /admin/superadmin.'}{' '}
        Suma más créditos: 500 destinatarios/día en Gmail personal, 2.000/día en Google Workspace.
      </p>
    </div>
  );
}
