import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { encryptSecret } from '@/lib/crypto';
import { obtenerConfigGoogle, intercambiarCodigoPorTokens, decodificarIdToken, leerState } from '@/lib/google-oauth';

/**
 * Vuelta del consentimiento de Google (2026-08-31) — el redirect_uri
 * exacto que se registró en Google Cloud Console apunta acá, no puede
 * moverse de este path sin actualizarlo también ahí (ver
 * lib/google-oauth.ts → REDIRECT_URI, y las instrucciones en
 * /admin/superadmin).
 *
 * NO depende de sesión/cookies para saber a quién corresponde esta
 * conexión — bug real confirmado en producción (2026-08-31): en esta
 * vuelta desde accounts.google.com, el navegador no manda NINGUNA
 * cookie, ni siquiera con una sesión activa (comportamiento real del
 * navegador en ese salto, no una sesión vencida). En cambio, `state`
 * mismo lleva el user_id cifrado (ver lib/google-oauth.ts → armarState/
 * leerState) — el callback lo desencripta y con eso alcanza, sin
 * requireAdmin() ni nada que dependa de cookies en esta request puntual.
 */
export async function GET(request: NextRequest) {
  const destino = new URL('/admin/settings/integrations', request.url);

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorGoogle = url.searchParams.get('error');

  if (errorGoogle) {
    // El admin canceló el consentimiento, o algo similar — no es un
    // error nuestro, no hace falta loguearlo.
    destino.searchParams.set('google_error', 'Cancelaste la conexión con Google.');
    return NextResponse.redirect(destino);
  }

  const stateLeido = state ? leerState(state) : null;

  if (!code || !stateLeido) {
    destino.searchParams.set('google_error', 'El intento de conexión no se pudo validar — probá de nuevo desde Integraciones.');
    return NextResponse.redirect(destino);
  }

  const config = await obtenerConfigGoogle();
  if (!config) {
    destino.searchParams.set('google_error', 'Google no está configurado a nivel plataforma todavía.');
    return NextResponse.redirect(destino);
  }

  try {
    const tokens = await intercambiarCodigoPorTokens(config.clientId, config.clientSecret, code);

    if (!tokens.refresh_token) {
      // No debería pasar (prompt=consent lo fuerza siempre), pero sin
      // refresh_token esta conexión no sirve para nada — no se guarda
      // nada a medias.
      destino.searchParams.set(
        'google_error',
        'Google no devolvió permiso permanente — si ya habías conectado esta cuenta antes, desconectala primero e intentá de nuevo.'
      );
      return NextResponse.redirect(destino);
    }

    const { email, hd } = decodificarIdToken(tokens.id_token);

    const supabase = createSupabaseServiceClient();
    const { error } = await supabase.from('google_accounts').upsert(
      {
        user_id: stateLeido.userId,
        google_email: email,
        refresh_token_encrypted: encryptSecret(tokens.refresh_token),
        tipo_cuenta: hd ? 'workspace' : 'personal',
        validated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    if (error) {
      console.error('Error guardando la cuenta de Google:', error);
      destino.searchParams.set('google_error', 'Google confirmó la conexión, pero no se pudo guardar acá. Probá de nuevo.');
      return NextResponse.redirect(destino);
    }

    destino.searchParams.set('google_ok', '1');
    return NextResponse.redirect(destino);
  } catch (e) {
    console.error('Error en el intercambio de tokens de Google:', e);
    destino.searchParams.set('google_error', 'No se pudo completar la conexión con Google. Probá de nuevo.');
    return NextResponse.redirect(destino);
  }
}
