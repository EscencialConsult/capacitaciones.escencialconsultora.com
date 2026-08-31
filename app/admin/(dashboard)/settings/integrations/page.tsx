import { createSupabaseServiceClient, requireAdmin } from '@/lib/supabase/server';
import { FormInput } from '../../FormInput';
import { IntegrationCard } from './IntegrationCard';
import { ResendDominioPropio } from './ResendDominioPropio';
import { GoogleIntegrationCard } from './GoogleIntegrationCard';
import {
  conectarBrevo,
  desconectarBrevo,
  conectarResend,
  desconectarResend,
  declararPlanBrevo,
  declararPlanResend,
} from './actions';

export const dynamic = 'force-dynamic';

// Instrucciones pegadas 1:1 del pedido de Facundo (2026-08-24) — foco en
// que alguien sin conocimientos técnicos las pueda seguir sin adivinar
// nada. Como texto/JSX simple (sin capturas ni GIFs todavía: no hay
// banco de imágenes para eso en el proyecto — ver el mismo criterio que
// SISTEMA_DISENO_LANDING en lib/landing-template-defaults.ts sobre no
// usar imágenes que no existen).
function InstruccionesBrevo() {
  return (
    <ol className="list-decimal space-y-2 pl-4">
      <li>
        <strong>Creá tu cuenta</strong> (si todavía no tenés una para esto, o usá la que ya tengas de Brevo) — andá a{' '}
        <a href="https://brevo.com" target="_blank" rel="noreferrer" className="text-one-fucsia hover:underline">
          brevo.com
        </a>{' '}
        y registrate gratis. Es TU cuenta, no una compartida — cada admin conecta la suya.
      </li>
      <li>
        <strong>Andá directo a la página de API Keys</strong> —{' '}
        <a
          href="https://app.brevo.com/settings/keys/api"
          target="_blank"
          rel="noreferrer"
          className="text-one-fucsia hover:underline"
        >
          app.brevo.com/settings/keys/api
        </a>{' '}
        (logueado con la cuenta de arriba). Si ese link no carga directo, es tu perfil (arriba a la derecha) → <strong>SMTP &amp; API</strong> → pestaña <strong>API Keys</strong> — ojo que NO es la pestaña &quot;SMTP&quot;, esa trae una clave con otro formato que acá no sirve.
      </li>
      <li>
        <strong>&quot;Generate a new API key&quot;</strong> (botón negro/violeta arriba) → ponele un nombre que reconozcas
        (ej. &quot;Landings Escencial&quot;) → si te pregunta por vencimiento/expiración de la clave, dejala <strong>sin límite de tiempo</strong> (&quot;No expiration&quot; / sin fecha) — una key que vence sola corta el envío de emails de golpe el día que caduque, sin ningún aviso. Confirmá con <strong>Generate</strong>.
      </li>
      <li>
        <strong>Copiá el código completo</strong> que te muestra — empieza con <code className="rounded-one-sm bg-one-oscuro/10 px-1">xkeysib-</code> y es largo (~80 caracteres). Brevo lo muestra <strong>una sola vez</strong>, así que copialo ahora.
      </li>
      <li>
        <div className="rounded-one-sm border border-one-dorado/40 bg-one-dorado/10 p-3">
          <strong className="text-one-oscuro">Paso obligatorio, fácil de saltear sin darte cuenta</strong> — andá a{' '}
          <a
            href="https://app.brevo.com/security/authorised_ips"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-one-fucsia hover:underline"
          >
            app.brevo.com/security/authorised_ips
          </a>{' '}
          y desactivá el bloqueo de IPs no autorizadas (&quot;Deactivate blocking&quot;). Sin esto, la clave se conecta y se
          valida perfecto acá arriba — el error recién aparece después, en silencio, cuando la plataforma intenta mandar un
          email de verdad desde un servidor que Brevo no reconoce. No hay forma de resolver esto desde acá: es una
          configuración de seguridad de tu cuenta de Brevo, solo se toca desde su panel.
        </div>
      </li>
      <li>
        <strong>Pegalo acá arriba</strong>, en el campo &quot;API Key de Brevo&quot; de este mismo panel, y guardá — nunca lo peques en un chat, un email ni ninguna nota aparte.
      </li>
    </ol>
  );
}

function InstruccionesResend() {
  return (
    <ol className="list-decimal space-y-2 pl-4">
      <li>
        <strong>Creá tu cuenta</strong> (si todavía no tenés una para esto) — andá a{' '}
        <a href="https://resend.com" target="_blank" rel="noreferrer" className="text-one-fucsia hover:underline">
          resend.com
        </a>{' '}
        y registrate gratis. Es TU cuenta, no una compartida — cada admin conecta la suya.
      </li>
      <li>
        <strong>Andá directo a la página de API Keys</strong> —{' '}
        <a href="https://resend.com/api-keys" target="_blank" rel="noreferrer" className="text-one-fucsia hover:underline">
          resend.com/api-keys
        </a>{' '}
        (si no carga directo: menú lateral izquierdo → <strong>API Keys</strong>).
      </li>
      <li>
        <strong>&quot;Create API Key&quot;</strong> → ponele un nombre que reconozcas (ej. &quot;Landings Escencial&quot;) → en <em>Permissions</em> dejala en <strong>Full Access</strong> (todavía no elegiste ningún dominio, así que <em>Sending access</em> no tiene de dónde elegir) → <strong>Add</strong>.
      </li>
      <li>
        <strong>Copiá el código completo</strong> que empieza con <code className="rounded-one-sm bg-one-oscuro/10 px-1">re_</code> — Resend lo muestra <strong>una sola vez</strong>, no lo vas a poder ver de nuevo después de cerrar esa pantalla.
      </li>
      <li>
        <strong>Pegalo acá arriba</strong>, en el campo &quot;API Key de Resend&quot; de este mismo panel, y guardá — nunca lo pegues en un chat, un email ni ninguna nota aparte.
      </li>
      <li>
        <div className="rounded-one-sm border border-one-cian/30 bg-one-cian/10 p-3">
          <strong className="text-one-oscuro">Ya no hace falta verificar un dominio a mano</strong> — una vez guardada la clave, este mismo panel te va a ofrecer crear tu subdominio propio (nombre.escencialconsultora.com) y lo verifica solo, sin que toques Hostinger ni resend.com/domains para nada.
        </div>
      </li>
    </ol>
  );
}

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: { google_ok?: string; google_error?: string };
}) {
  const admin = await requireAdmin();
  const supabase = createSupabaseServiceClient();

  // Por persona (2026-08-26) — cada admin conecta sus propias cuentas,
  // ya no hay una sola fila global compartida por todo el panel. El
  // sistema de créditos (ver migración 0019) cobra según de quién es
  // la cuenta que activó cada campaña, así que lo que se ve/conecta
  // acá tiene que ser exactamente lo que ESTE admin va a consumir.
  const [{ data: brevo }, { data: resend }, { data: googleConfig }, { data: google }, { data: solicitudGoogle }] = await Promise.all([
    supabase
      .from('brevo_accounts')
      .select('api_key_encrypted, api_key_last4, validated_at, daily_limit, plan_tipo, creditos_pago')
      .eq('user_id', admin?.id ?? '')
      .maybeSingle(),
    supabase
      .from('resend_accounts')
      .select('api_key_last4, validated_at, plan_tipo, creditos_pago, sender_email, dominio_nombre, dominio_estado, dominio_error')
      .eq('user_id', admin?.id ?? '')
      .maybeSingle(),
    supabase.from('google_oauth_config').select('id').eq('id', 1).maybeSingle(),
    supabase
      .from('google_accounts')
      .select('google_email, tipo_cuenta, plan_tipo, creditos_pago')
      .eq('user_id', admin?.id ?? '')
      .maybeSingle(),
    supabase.from('google_connection_requests').select('estado').eq('user_id', admin?.id ?? '').maybeSingle(),
  ]);

  const brevoConectado = !!brevo?.api_key_encrypted;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-extrabold tracking-tight text-one-oscuro">Integraciones</h1>
      <p className="mt-1 text-sm text-one-oscuro/60">
        Conectá tus propias cuentas para mandar los emails de las campañas que vos actives — cada admin tiene las
        suyas, y de ahí salen tus créditos mensuales (ver Mi perfil). No hace falta tocar código ni variables de
        entorno — pegá la clave acá, la validamos con el proveedor y listo.
      </p>

      {searchParams.google_ok && (
        <p className="mt-4 rounded-one-sm bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
          Google conectado correctamente.
        </p>
      )}
      {searchParams.google_error && (
        <p className="mt-4 rounded-one-sm border border-one-rojo/40 bg-one-rojo/10 px-3 py-2 text-sm text-one-oscuro">
          {searchParams.google_error}
        </p>
      )}

      <div className="mt-6 space-y-5">
        <div style={{ '--stagger-index': 0 } as React.CSSProperties} className="stagger-in">
          <IntegrationCard
            proveedor="Brevo"
            colorAcento="rojo"
            prefijoEsperado="xkeysib-"
            conectado={brevoConectado}
            apiKeyLast4={brevo?.api_key_last4}
            validatedAt={brevo?.validated_at}
            onConectar={conectarBrevo}
            onDesconectar={desconectarBrevo}
            instrucciones={<InstruccionesBrevo />}
            planTipo={(brevo?.plan_tipo as 'free' | 'pago') ?? 'free'}
            creditosPago={brevo?.creditos_pago}
            creditosFreeCalculados={(brevo?.daily_limit ?? 300) * 30}
            onDeclararPlan={declararPlanBrevo}
            camposExtra={
              !brevoConectado && (
                <div className="space-y-4 rounded-one-sm bg-one-oscuro/5 p-4">
                  <p className="text-xs text-one-oscuro/60">
                    Todavía no conectaste ninguna cuenta de Brevo — completá también desde dónde se van a mandar tus emails.
                  </p>
                  <FormInput id="sender_email" name="sender_email" type="email" label="Email de remitente" placeholder="hola@escencialconsult.com.ar" required />
                  <FormInput id="sender_name" name="sender_name" label="Nombre de remitente" placeholder="Escencial Consultora" />
                </div>
              )
            }
          />
        </div>

        <div style={{ '--stagger-index': 1 } as React.CSSProperties} className="stagger-in">
          <IntegrationCard
            proveedor="Resend"
            colorAcento="azul"
            prefijoEsperado="re_"
            conectado={!!resend?.api_key_last4}
            apiKeyLast4={resend?.api_key_last4}
            validatedAt={resend?.validated_at}
            onConectar={conectarResend}
            onDesconectar={desconectarResend}
            instrucciones={<InstruccionesResend />}
            planTipo={(resend?.plan_tipo as 'free' | 'pago') ?? 'free'}
            creditosPago={resend?.creditos_pago}
            creditosFreeCalculados={3000}
            onDeclararPlan={declararPlanResend}
            camposExtra={
              !resend?.api_key_last4 && (
                <div className="space-y-4 rounded-one-sm bg-one-oscuro/5 p-4">
                  <p className="text-xs text-one-oscuro/60">
                    No hace falta cargar remitente todavía — después de guardar la clave, este mismo panel te ofrece
                    crear tu subdominio de envío propio y lo verifica solo. Si ya tenés un dominio propio verificado
                    de antes en Resend, opcionalmente completalo acá.
                  </p>
                  <FormInput id="sender_email" name="sender_email" type="email" label="Email de remitente (opcional)" placeholder="hola@tudominio.com" />
                  <FormInput id="sender_name" name="sender_name" label="Nombre de remitente (opcional)" placeholder="Escencial Consultora" />
                </div>
              )
            }
          />
          {resend?.api_key_last4 && (
            <ResendDominioPropio
              dominioNombre={resend.dominio_nombre}
              dominioEstado={resend.dominio_estado as 'pendiente' | 'verificado' | 'error' | null}
              dominioError={resend.dominio_error}
              senderEmail={resend.sender_email}
            />
          )}
        </div>

        <div style={{ '--stagger-index': 2 } as React.CSSProperties} className="stagger-in">
          <GoogleIntegrationCard
            configuradoAlgunavez={!!googleConfig}
            conectado={!!google}
            googleEmail={google?.google_email ?? null}
            tipoCuenta={(google?.tipo_cuenta as 'personal' | 'workspace') ?? null}
            planTipo={(google?.plan_tipo as 'free' | 'pago') ?? 'free'}
            creditosPago={google?.creditos_pago}
            estadoSolicitud={(solicitudGoogle?.estado as 'pendiente' | 'aprobado' | 'rechazado') ?? null}
          />
        </div>
      </div>

      <p className="mt-6 text-xs text-one-oscuro/40">
        Cuando actives una campaña, sus emails se mandan por la cuenta que tengas conectada — si tenés las dos,
        Brevo tiene prioridad y Resend queda de respaldo. Sin ninguna cuenta propia conectada, no vas a poder
        activar ninguna campaña.
      </p>
    </div>
  );
}
