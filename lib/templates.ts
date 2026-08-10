/**
 * Reemplaza placeholders {{clave}} en un string HTML. Mismo mecanismo
 * que usaba Apps Script (reemplazarPlaceholders_) — se preserva porque
 * ya está probado y es fácil de razonar: no hay lógica de template
 * engine escondida, solo un find/replace literal por clave.
 */
export function replacePlaceholders(html: string, values: Record<string, string>): string {
  let result = html;
  for (const [key, value] of Object.entries(values)) {
    result = result.replaceAll(`{{${key}}}`, value ?? '');
  }
  return result;
}
