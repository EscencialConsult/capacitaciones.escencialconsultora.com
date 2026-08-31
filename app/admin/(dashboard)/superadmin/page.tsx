import { notFound } from 'next/navigation';
import { ChevronDown, ShieldCheck } from 'lucide-react';
import { createSupabaseServiceClient, requireAdmin } from '@/lib/supabase/server';
import { esSuperAdmin } from '@/lib/superadmin';
import { ConfigGoogleForm } from './ConfigGoogleForm';

export const dynamic = 'force-dynamic';

/**
 * Config de toda la plataforma, no de un admin puntual (2026-08-31,
 * pedido explícito: "hagamos una interfaz superadmin... esto de
 * acreditar las cuentas lo armamos nosotros en superadmin, para que sea
 * lo más sencillo para los admins"). Antes esto (el Client ID/Secret de
 * Google OAuth) iba a mostrarse como instrucciones sueltas en
 * Integraciones, visibles para CUALQUIER admin — mal, porque crear un
 * proyecto de Google Cloud no es algo que le corresponda ver ni hacer a
 * cada admin, es un paso único de toda la plataforma. Acá vive
 * gateado, y una vez configurado, el admin de a pie en /admin/settings/
 * integrations va a ver solo un botón simple de "Conectar con Google"
 * — sin tener que enterarse de que existe Google Cloud Console.
 *
 * Gateo por esSuperAdmin (lista de emails en una variable de entorno,
 * ver lib/superadmin.ts) — no por rol en la base, deliberadamente
 * liviano. notFound() en vez de un mensaje de "no autorizado": mismo
 * criterio de todo el panel (ver middleware.ts, /admin sin sesión da
 * 404) — quien no es superadmin ni se entera de que esta pantalla existe.
 */
export default async function SuperadminPage() {
  const admin = await requireAdmin();
  if (!admin || !esSuperAdmin(admin.email)) {
    notFound();
  }

  const supabase = createSupabaseServiceClient();
  const { data: config } = await supabase
    .from('google_oauth_config')
    .select('client_id, configurado_en')
    .eq('id', 1)
    .maybeSingle();

  return (
    <div className="max-w-3xl">
      <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-one-oscuro">
        <ShieldCheck className="size-6 text-one-fucsia" strokeWidth={1.75} />
        Superadmin
      </h1>
      <p className="mt-1 text-sm text-one-oscuro/60">
        Configuración de toda la plataforma — no aparece para el resto de los admins.
      </p>

      <div className="mt-6 rounded-one-lg border border-one-oscuro/10 bg-one-blanco p-6 shadow-one-sm">
        <h2 className="text-lg font-extrabold text-one-oscuro">Google OAuth</h2>
        <p className="mt-1 text-sm text-one-oscuro/70">
          Una sola vez para toda la plataforma — después, cada admin conecta su propia cuenta de
          Gmail desde Integraciones con un click, sin ver nada de esto.
        </p>

        <details className="group mt-5 rounded-one-sm bg-one-oscuro/5 open:pb-4">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-one-oscuro">
            ¿Cómo se genera el Client ID y Client Secret?
            <ChevronDown className="size-4 text-one-oscuro/40 transition-transform duration-200 group-open:rotate-180" />
          </summary>
          <div className="space-y-2 px-4 text-sm text-one-oscuro/70">
            <ol className="list-decimal space-y-2 pl-4">
              <li>
                Andá a{' '}
                <a
                  href="https://console.cloud.google.com/projectcreate"
                  target="_blank"
                  rel="noreferrer"
                  className="text-one-fucsia hover:underline"
                >
                  console.cloud.google.com/projectcreate
                </a>{' '}
                → creá un proyecto nuevo, nombre sugerido <strong>&quot;Escencial Landings&quot;</strong>.
              </li>
              <li>
                Con ese proyecto seleccionado (arriba a la izquierda), andá a{' '}
                <strong>APIs &amp; Services → Library</strong>, buscá{' '}
                <strong>&quot;Gmail API&quot;</strong> y tocá <strong>Enable</strong>.
              </li>
              <li>
                Andá a <strong>APIs &amp; Services → OAuth consent screen</strong> → elegí{' '}
                <strong>External</strong> (a menos que TODOS los admins tengan cuenta de Google
                Workspace del mismo dominio, ahí sería Internal) → completá nombre de la app, email
                de soporte, y en <strong>Scopes</strong> agregá{' '}
                <code className="rounded-one-sm bg-one-oscuro/10 px-1">.../auth/gmail.send</code>.
              </li>
              <li>
                <div className="rounded-one-sm border border-one-dorado/40 bg-one-dorado/10 p-3">
                  <strong className="text-one-oscuro">Paso obligatorio mientras esto esté en modo prueba</strong> —
                  sección <strong>Test users</strong> de la misma pantalla, agregá el email de
                  Google de cada admin que vaya a conectar su cuenta (hasta 100). Sin esto, Google
                  les rechaza el login. Mientras se quede en menos de 100 admins conectados, NO hace
                  falta mandar la app a revisión de Google.
                </div>
              </li>
              <li>
                Andá a{' '}
                <strong>APIs &amp; Services → Credentials → Create Credentials → OAuth client ID</strong> →
                tipo <strong>Web application</strong> → en <strong>Authorized redirect URIs</strong>{' '}
                agregá exactamente:{' '}
                <code className="rounded-one-sm bg-one-oscuro/10 px-1 break-all">
                  https://capacitaciones.escencialconsultora.com/admin/settings/integrations/google/callback
                </code>{' '}
                → <strong>Create</strong>.
              </li>
              <li>
                Google te muestra el <strong>Client ID</strong> y el <strong>Client Secret</strong> —
                copiá los dos y pegalos acá abajo.
              </li>
            </ol>
          </div>
        </details>

        <ConfigGoogleForm
          yaConfigurado={!!config}
          clientId={config?.client_id ?? null}
          configuradoEn={config?.configurado_en ?? null}
        />
      </div>
    </div>
  );
}
