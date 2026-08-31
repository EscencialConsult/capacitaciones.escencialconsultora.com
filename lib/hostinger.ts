// Cliente de bajo nivel para la API de DNS de Hostinger (ver skill
// mcp-hostinguer) — compartido por lib/dominio-landing.ts (subdominio
// por landing) y lib/dominio-resend.ts (verificación de dominio de
// envío por admin). Todo lo que toca la zona real de escencialconsultora
// .com pasa por acá, un solo lugar.

const DOMINIO_BASE = 'escencialconsultora.com';

function hostingerToken(): string {
  const t = process.env.HOSTINGER_API_TOKEN;
  if (!t) throw new Error('Falta la variable de entorno HOSTINGER_API_TOKEN.');
  return t;
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

export type RegistroDNS = { name: string; type: string; ttl: number; records: { content: string; is_disabled?: boolean }[] };
export type RegistroAEscribir = { name: string; type: string; ttl: number; content: string };

export async function leerZona(dominio: string = DOMINIO_BASE): Promise<RegistroDNS[]> {
  const resp = await hostingerFetch(`/dns/v1/zones/${dominio}`);
  return resp.json();
}

/**
 * overwrite: false SIEMPRE — confirmado en producción (2026-08-28/31):
 * crea lo que no existe y actualiza en el lugar lo que ya existe con el
 * mismo name+type, sin tocar ningún otro registro de la zona. Nunca usar
 * overwrite: true acá, borraría registros de otros proyectos.
 */
export async function escribirRegistros(registros: RegistroAEscribir[], dominio: string = DOMINIO_BASE): Promise<void> {
  await hostingerFetch(`/dns/v1/zones/${dominio}`, {
    method: 'PUT',
    body: JSON.stringify({
      overwrite: false,
      zone: registros.map((r) => ({ name: r.name, type: r.type, ttl: r.ttl, records: [{ content: r.content }] })),
    }),
  });
}

export async function borrarRegistro(name: string, type: string, dominio: string = DOMINIO_BASE): Promise<void> {
  await hostingerFetch(`/dns/v1/zones/${dominio}`, {
    method: 'DELETE',
    body: JSON.stringify({ filters: [{ name, type }] }),
  });
}

export { DOMINIO_BASE };
