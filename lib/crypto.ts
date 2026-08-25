import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Cifrado simétrico para secretos que el ADMIN carga vía UI (API keys de
 * Brevo/Resend, panel de Integraciones — ver
 * app/admin/(dashboard)/settings/integrations) y que necesitan guardarse
 * en la base para poder usarse después (a diferencia de las API keys
 * "de siempre" del sistema, que viven en variables de entorno y nunca
 * tocan la base — ver brevo_accounts.env_var_name en
 * supabase/migrations/0001_init.sql). AES-256-GCM: cifrado autenticado,
 * no solo ofuscación — si alguien altera el texto cifrado a mano
 * (directo en la base), desencriptar falla en vez de devolver basura
 * silenciosa.
 *
 * SECRETS_ENCRYPTION_KEY tiene que ser un valor de 32 bytes en base64
 * (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`).
 * Fallar cerrado si falta: sin esto, guardar o leer un secreto tiene que
 * tirar error, nunca guardar en texto plano como respaldo silencioso.
 */
function obtenerClave(): Buffer {
  const b64 = process.env.SECRETS_ENCRYPTION_KEY;
  if (!b64) {
    throw new Error(
      'Falta la variable de entorno SECRETS_ENCRYPTION_KEY — sin ella no se puede cifrar ni leer ningún secreto guardado desde el panel de Integraciones.'
    );
  }
  const clave = Buffer.from(b64, 'base64');
  if (clave.length !== 32) {
    throw new Error('SECRETS_ENCRYPTION_KEY tiene que decodificar a exactamente 32 bytes (AES-256).');
  }
  return clave;
}

// Formato guardado: "v1:<iv base64>:<authTag base64>:<ciphertext base64>"
// El prefijo de versión permite cambiar de esquema el día de mañana sin
// romper los valores ya guardados (se podría soportar leer v1 y escribir
// v2 en paralelo).
const VERSION = 'v1';

export function encryptSecret(texto: string): string {
  const iv = randomBytes(12); // 96 bits — tamaño recomendado para GCM
  const cipher = createCipheriv('aes-256-gcm', obtenerClave(), iv);
  const cifrado = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString('base64')}:${authTag.toString('base64')}:${cifrado.toString('base64')}`;
}

export function decryptSecret(valorGuardado: string): string {
  const partes = valorGuardado.split(':');
  if (partes.length !== 4 || partes[0] !== VERSION) {
    throw new Error('Formato de secreto cifrado inválido o de una versión no soportada.');
  }
  const [, ivB64, authTagB64, cifradoB64] = partes;
  const decipher = createDecipheriv('aes-256-gcm', obtenerClave(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  const texto = Buffer.concat([decipher.update(Buffer.from(cifradoB64, 'base64')), decipher.final()]);
  return texto.toString('utf8');
}

/** Últimos 4 caracteres de la clave real, para mostrar en el panel sin
 * tener que desencriptar en cada carga de página (ej. "sk_live_••••1234"). */
export function ultimos4(texto: string): string {
  return texto.slice(-4);
}
