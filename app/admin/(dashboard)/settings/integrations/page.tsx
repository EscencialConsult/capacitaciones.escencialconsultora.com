import { createSupabaseServiceClient, requireAdmin } from '@/lib/supabase/server';
import { FormInput } from '../../FormInput';
import { IntegrationCard } from './IntegrationCard';
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
        <strong>Verificá tu dominio primero</strong> (obligatorio antes de poder mandar nada) — andá directo a{' '}
        <a href="https://resend.com/domains" target="_blank" rel="noreferrer" className="text-one-fucsia hover:underline">
          resend.com/domains
        </a>{' '}
        → <strong>Add Domain</strong> → seguí los pasos para agregar los registros DNS (tipo TXT/MX/CNAME) en tu proveedor de dominio (Cloudflare, GoDaddy, etc.). Sin esto verificado, Resend no deja mandar ningún email o los manda directo a spam — no sirve usar un email de Gmail como remitente acá, tiene que ser un dominio propio verificado.
      </li>
      <li>
        <strong>Andá directo a la página de API Keys</strong> —{' '}
        <a href="https://resend.com/api-keys" target="_blank" rel="noreferrer" className="text-one-fucsia hover:underline">
          resend.com/api-keys
        </a>{' '}
        (si no carga directo: menú lateral izquierdo → <strong>API Keys</strong>).
      </li>
      <li>
        <strong>&quot;Create API Key&quot;</strong> → ponele un nombre que reconozcas (ej. &quot;Landings Escencial&quot;) → en <em>Permissions</em> dejala en <strong>Full Access</strong> o <strong>Sending access</strong> (cualquiera de las dos sirve para mandar emails) → si te deja elegir el dominio, elegí el que verificaste en el paso 2 → <strong>Add</strong>.
      </li>
      <li>
        <strong>Copiá el código completo</strong> que empieza con <code className="rounded-one-sm bg-one-oscuro/10 px-1">re_</code> — Resend lo muestra <strong>una sola vez</strong>, no lo vas a poder ver de nuevo después de cerrar esa pantalla.
      </li>
      <li>
        <strong>Pegalo acá arriba</strong>, en el campo &quot;API Key de Resend&quot; de este mismo panel, y guardá — nunca lo pegues en un chat, un email ni ninguna nota aparte.
      </li>
    </ol>
  );
}

export default async function IntegrationsPage() {
  const admin = await requireAdmin();
  const supabase = createSupabaseServiceClient();

  // Por persona (2026-08-26) — cada admin conecta sus propias cuentas,
  // ya no hay una sola fila global compartida por todo el panel. El
  // sistema de créditos (ver migración 0019) cobra según de quién es
  // la cuenta que activó cada campaña, así que lo que se ve/conecta
  // acá tiene que ser exactamente lo que ESTE admin va a consumir.
  const [{ data: brevo }, { data: resend }] = await Promise.all([
    supabase
      .from('brevo_accounts')
      .select('api_key_encrypted, api_key_last4, validated_at, daily_limit, plan_tipo, creditos_pago')
      .eq('user_id', admin?.id ?? '')
      .maybeSingle(),
    supabase
      .from('resend_accounts')
      .select('api_key_last4, validated_at, plan_tipo, creditos_pago')
      .eq('user_id', admin?.id ?? '')
      .maybeSingle(),
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
                    Todavía no conectaste ninguna cuenta de Resend — completá también el remitente. Tiene que ser un
                    email de un dominio que ya verificaste en Resend (resend.com/domains), nunca un @gmail.com.
                  </p>
                  <FormInput id="sender_email" name="sender_email" type="email" label="Email de remitente" placeholder="hola@tudominio.com" required />
                  <FormInput id="sender_name" name="sender_name" label="Nombre de remitente" placeholder="Escencial Consultora" />
                </div>
              )
            }
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
