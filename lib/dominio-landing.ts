// Subdominio propio por landing (2026-08-31, pedido explícito: "que
// vaya el nombre de la landing antes del dominio" — nombre-de-landing.
// escencialconsultora.com en vez de solo capacitaciones.escencialconsultora
// .com/nombre-de-landing). Dos APIs orquestadas:
//   - Hostinger (DNS del dominio real, ver skill mcp-hostinguer): crea/
//     borra el registro CNAME específico de cada landing.
//   - Netlify (el sitio en sí): agrega/saca ese subdominio como "domain
//     alias" — necesario para que Netlify emita el certificado SSL y
//     sirva el sitio ahí (un CNAME solo, sin esto, da 404 de Netlify).
//
// Wildcard (*.escencialconsultora.com) DESCARTADO a propósito — probado
// en producción el 2026-08-31 y Netlify no puede emitir un certificado
// wildcard automático sin controlar el DNS del dominio (challenge
// DNS-01), y ese DNS vive en Hostinger, no en Netlify. Un CNAME
// específico por landing sí funciona (mismo patrón que ya usa
// "capacitaciones" para el panel en sí) porque un dominio exacto se
// valida con un challenge HTTP-01, que no depende de quién maneje el DNS.
//
// SIEMPRE aditivo: si esto falla (colisión, API caída, lo que sea), la
// landing sigue funcionando en su link de siempre
// (capacitaciones.escencialconsultora.com/slug, ver app/[slug]/route.ts)
// — nunca bloquea crear/guardar una landing, solo agrega o no el
// subdominio propio.

const DOMINIO_BASE = 'escencialconsultora.com';

function hostingerToken(): string {
  const t = process.env.HOSTINGER_API_TOKEN;
  if (!t) throw new Error('Falta la variable de entorno HOSTINGER_API_TOKEN.');
  return t;
}

function netlifyToken(): string {
  const t = process.env.NETLIFY_API_TOKEN;
  if (!t) throw new Error('Falta la variable de entorno NETLIFY_API_TOKEN.');
  return t;
}

function netlifySiteId(): string {
  const id = process.env.NETLIFY_SITE_ID;
  if (!id) throw new Error('Falta la variable de entorno NETLIFY_SITE_ID.');
  return id;
}

// Con el punto final (FQDN) — así el content que se guarda en Hostinger
// coincide EXACTO con cómo Hostinger ya devuelve el CNAME existente de
// "capacitaciones" (confirmado leyendo la zona real), evitando falsos
// negativos al comparar en subdominioOcupadoPorOtraCosa.
function netlifyDestino(): string {
  const d = process.env.NETLIFY_DEFAULT_DOMAIN;
  if (!d) throw new Error('Falta la variable de entorno NETLIFY_DEFAULT_DOMAIN.');
  return d.endsWith('.') ? d : `${d}.`;
}

async function hostingerFetch(path: string, init?: RequestInit): Promise<Response> {
  const resp = await fetch(`https://developers.hostinger.com/api${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${hostingerToken()}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!resp.ok) {
    const texto = await resp.text().catch(() => '');
    throw new Error(`Hostinger API respondió ${resp.status}: ${texto.slice(0, 300)}`);
  }
  return resp;
}

async function netlifyFetch(path: string, init?: RequestInit): Promise<Response> {
  const resp = await fetch(`https://api.netlify.com/api/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${netlifyToken()}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!resp.ok) {
    const texto = await resp.text().catch(() => '');
    throw new Error(`Netlify API respondió ${resp.status}: ${texto.slice(0, 300)}`);
  }
  return resp;
}

type RegistroDNS = { name: string; type: string; records: { content: string }[] };

async function leerZona(): Promise<RegistroDNS[]> {
  const resp = await hostingerFetch(`/dns/v1/zones/${DOMINIO_BASE}`);
  return resp.json();
}

/**
 * true si `slug` ya está ocupado por OTRA cosa en la zona DNS real —
 * management/packonetalent/alumnos/etc, cualquiera de los ~160 registros
 * que ya viven ahí de otros proyectos. false si está libre, o si ya
 * apunta exactamente a nuestro propio sitio (re-publicar la misma
 * landing es idempotente, no una colisión).
 */
export async function subdominioOcupadoPorOtraCosa(slug: string): Promise<boolean> {
  const zona = await leerZona();
  const destino = netlifyDestino();
  const fila = zona.find((r) => r.name.toLowerCase() === slug.toLowerCase());
  if (!fila) return false;
  const yaEsNuestro = fila.type === 'CNAME' && fila.records.some((r) => r.content === destino);
  return !yaEsNuestro;
}

async function crearOActualizarCNAME(slug: string): Promise<void> {
  await hostingerFetch(`/dns/v1/zones/${DOMINIO_BASE}`, {
    method: 'PUT',
    body: JSON.stringify({
      overwrite: false,
      zone: [{ name: slug, type: 'CNAME', ttl: 14400, records: [{ content: netlifyDestino() }] }],
    }),
  });
}

async function borrarCNAME(slug: string): Promise<void> {
  await hostingerFetch(`/dns/v1/zones/${DOMINIO_BASE}`, {
    method: 'DELETE',
    body: JSON.stringify({ filters: [{ name: slug, type: 'CNAME' }] }),
  });
}

async function agregarAliasNetlify(dominioCompleto: string): Promise<void> {
  const site = await (await netlifyFetch(`/sites/${netlifySiteId()}`)).json();
  const actuales: string[] = site.domain_aliases ?? [];
  if (actuales.includes(dominioCompleto)) return;
  await netlifyFetch(`/sites/${netlifySiteId()}`, {
    method: 'PATCH',
    body: JSON.stringify({ domain_aliases: [...actuales, dominioCompleto] }),
  });
}

async function quitarAliasNetlify(dominioCompleto: string): Promise<void> {
  const site = await (await netlifyFetch(`/sites/${netlifySiteId()}`)).json();
  const actuales: string[] = site.domain_aliases ?? [];
  if (!actuales.includes(dominioCompleto)) return;
  await netlifyFetch(`/sites/${netlifySiteId()}`, {
    method: 'PATCH',
    body: JSON.stringify({ domain_aliases: actuales.filter((d) => d !== dominioCompleto) }),
  });
}

export function urlPublicaDeLanding(slug: string): string {
  return `https://${slug}.${DOMINIO_BASE}`;
}

/**
 * Publica el subdominio propio de una landing — se llama DESPUÉS de
 * guardar la landing en la base, nunca antes: si esto falla, la landing
 * ya existe y sigue 100% accesible por su link clásico
 * (capacitaciones.escencialconsultora.com/slug). El resultado se guarda
 * en landings.subdominio_error (null = ok) para que la lista lo muestre
 * sin depender de una llamada a una API externa en cada carga de pantalla.
 */
export async function publicarSubdominioDeLanding(slug: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const dominioCompleto = `${slug}.${DOMINIO_BASE}`;
  try {
    if (await subdominioOcupadoPorOtraCosa(slug)) {
      return {
        ok: false,
        error: `${dominioCompleto} ya está en uso para otra cosa — elegí otro nombre de link si querés su propio subdominio (el link clásico funciona igual).`,
      };
    }
    await crearOActualizarCNAME(slug);
    await agregarAliasNetlify(dominioCompleto);
    return { ok: true };
  } catch (e) {
    console.error('Error publicando subdominio de landing:', e);
    return {
      ok: false,
      error: `No se pudo preparar ${dominioCompleto} (el link clásico funciona igual). Volvé a guardar la landing para reintentar.`,
    };
  }
}

/**
 * Saca el subdominio propio de una landing — al borrarla, o cuando
 * cambia de slug (para no dejar el viejo apuntando a nada). Best
 * effort a propósito: nunca bloquea borrar/guardar la landing por esto
 * — un registro huérfano no rompe nada, el middleware simplemente no
 * encuentra ninguna landing con ese slug.
 */
export async function despublicarSubdominioDeLanding(slug: string): Promise<void> {
  const dominioCompleto = `${slug}.${DOMINIO_BASE}`;
  try {
    await borrarCNAME(slug);
    await quitarAliasNetlify(dominioCompleto);
  } catch (e) {
    console.error('Error despublicando subdominio de landing (no bloquea la acción principal):', e);
  }
}
