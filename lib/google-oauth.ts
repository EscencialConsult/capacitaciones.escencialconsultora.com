// Google como 3er proveedor de envío (2026-08-31, pedido explícito) —
// cada admin conecta SU Gmail por OAuth (nunca pega ninguna clave, a
// diferencia de Brevo/Resend). Client ID/Secret son de toda la
// plataforma (ver /admin/superadmin, migración 0027) — este módulo los
// lee de ahí, nunca de variables de entorno.
//
// Scope pedido: gmail.send (mandar en nombre del admin, nada de leer su
// correo) + openid/email/profile — el id_token que devuelve el
// intercambio trae el email Y el claim "hd" (hosted domain), que existe
// SOLO en cuentas de Google Workspace — así se detecta personal vs.
// Workspace sin preguntarle nada al admin (ver migración 0028/0029
// para los límites reales de cada uno).

import { createSupabaseServiceClient } from './supabase/server';
import { decryptSecret } from './crypto';

const REDIRECT_URI = 'https://capacitaciones.escencialconsultora.com/admin/settings/integrations/google/callback';
const SCOPES = ['https://www.googleapis.com/auth/gmail.send', 'openid', 'email', 'profile'];

export async function obtenerConfigGoogle(): Promise<{ clientId: string; clientSecret: string } | null> {
  const supabase = createSupabaseServiceClient();
  const { data } = await supabase.from('google_oauth_config').select('client_id, client_secret_encrypted').eq('id', 1).maybeSingle();
  if (!data) return null;
  return { clientId: data.client_id, clientSecret: decryptSecret(data.client_secret_encrypted) };
}

/**
 * URL de consentimiento de Google. `state` viaja de ida y vuelta sin
 * tocar — se usa para CSRF (un valor random que se compara al volver,
 * ver el callback) Y para saber a qué admin corresponde este intento
 * (el user_id, ya que Google no manda de vuelta nada nuestro más que
 * esto). access_type=offline + prompt=consent: sin esto, Google NO
 * devuelve refresh_token en re-conexiones (solo la primera vez que un
 * usuario autoriza esta app) — con prompt=consent lo fuerza siempre,
 * necesario porque sin refresh_token no se puede volver a mandar nada
 * pasada una hora (así de corto dura el access_token solo).
 */
export function urlAutorizacionGoogle(clientId: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

type TokensGoogle = { access_token: string; refresh_token?: string; id_token: string; expires_in: number };

async function pedirTokens(body: URLSearchParams): Promise<TokensGoogle> {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!resp.ok) {
    const texto = await resp.text().catch(() => '');
    throw new Error(`Google token endpoint respondió ${resp.status}: ${texto.slice(0, 300)}`);
  }
  return resp.json();
}

export async function intercambiarCodigoPorTokens(
  clientId: string,
  clientSecret: string,
  code: string
): Promise<TokensGoogle> {
  return pedirTokens(
    new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    })
  );
}

export async function refrescarAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const tokens = await pedirTokens(
    new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    })
  );
  return tokens.access_token;
}

/**
 * Decodifica el payload del id_token (JWT) SIN verificar la firma —
 * suficiente y seguro acá porque este token no llega desde el
 * navegador de un usuario ni de ningún origen no confiable: se acaba de
 * recibir DIRECTO del endpoint HTTPS de Google en pedirTokens() de
 * arriba, en el mismo request server-to-server. Verificar la firma
 * tendría sentido si este token viniera del cliente (ej. Google
 * Sign-In en el navegador), que no es este caso.
 */
export function decodificarIdToken(idToken: string): { email: string; hd?: string } {
  const payload = idToken.split('.')[1];
  const json = Buffer.from(payload, 'base64url').toString('utf8');
  return JSON.parse(json);
}

/**
 * Arma y manda un email real vía Gmail API (users.messages.send) —
 * mismo criterio de "un solo intento, sin reintentos automáticos acá
 * adentro" que enviarPorBrevo/enviarPorResend (el reintento con backoff
 * ya lo maneja processPendingEmails() por fuera). El mensaje se arma a
 * mano en formato MIME básico (RFC 2822) y se manda en base64url, como
 * pide la API — no hace falta ninguna librería para esto.
 */
export async function enviarPorGmail(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  opciones: { to: string; from: string; fromName: string; subject: string; html: string }
): Promise<void> {
  const accessToken = await refrescarAccessToken(clientId, clientSecret, refreshToken);

  const asuntoCodificado = `=?UTF-8?B?${Buffer.from(opciones.subject, 'utf8').toString('base64')}?=`;
  const mime = [
    `From: ${opciones.fromName} <${opciones.from}>`,
    `To: ${opciones.to}`,
    `Subject: ${asuntoCodificado}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    opciones.html,
  ].join('\r\n');

  const raw = Buffer.from(mime, 'utf8').toString('base64url');

  const resp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });

  if (!resp.ok) {
    const texto = await resp.text().catch(() => '');
    throw new Error(`Gmail API respondió ${resp.status}: ${texto.slice(0, 300)}`);
  }
}
