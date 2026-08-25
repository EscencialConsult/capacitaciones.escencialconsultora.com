/**
 * Reemplaza placeholders {{clave}} en un string HTML. Mismo mecanismo
 * que usaba Apps Script (reemplazarPlaceholders_) — se preserva porque
 * ya está probado y es fácil de razonar: no hay lógica de template
 * engine escondida, solo un find/replace literal por clave.
 *
 * Un solo pase de regex sobre el HTML ORIGINAL, nunca clave por clave
 * sobre un string ya mutado: si el valor de una variable contiene
 * literalmente "{{otraClave}}", con un loop de result.replaceAll ese
 * texto queda expuesto en result y la vuelta correspondiente a
 * "otraClave" lo reemplaza igual, aunque el HTML original de la
 * plantilla nunca haya tenido ese placeholder ahí. Haciendo un solo
 * pase sobre `html` (no sobre lo ya reemplazado), eso no puede pasar.
 * La regex tolera espacios adentro de las llaves ({{ clave }}) para no
 * desalinearse de extraerVariablesDeHtml (lib/landing-template-defaults.ts),
 * que detecta los campos del panel con esa misma tolerancia — antes,
 * una plantilla con "{{ titulo }}" se detectaba bien en el panel pero
 * nunca se reemplazaba acá.
 *
 * MISMO charset que extraerVariablesDeHtml (\p{L}\p{N}_- con flag u):
 * alfabeto español completo (tildes, ñ) + guion medio, no solo
 * a-zA-Z0-9_. Antes esta regex era más angosta que la del detector del
 * panel — el panel mostraba {{título}} o {{precio-plan-1}} como campo
 * editable y lo guardaba, pero acá nunca hacía match, así que la
 * landing pública y los emails de seguimiento mostraban el placeholder
 * literal en vez del contenido cargado, sin ningún error en el medio.
 */
export function replacePlaceholders(html: string, values: Record<string, string>): string {
  return html.replace(/\{\{\s*([\p{L}\p{N}_-]+)\s*\}\}/gu, (_coincidencia, key: string) => {
    return escapeHtml(values[key] ?? '');
  });
}

/**
 * Escapa entidades HTML antes de intercalar un valor de campaña en la
 * plantilla. Sin esto, cualquier admin con acceso a /admin/campaigns
 * podía cargar un var_* con <script>...</script> y quedaba servido tal
 * cual en la landing pública — se ejecutaba en el navegador de
 * cualquier visitante, sin nada en el medio que lo bloqueara.
 */
function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
