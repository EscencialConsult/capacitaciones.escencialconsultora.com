// Verificación automática de dominio de Resend por admin (2026-08-31,
// pedido explícito: "que cada persona cree su propia cuenta en Resend y
// coloque acá su token... para que el sistema ya directamente hostee").
// Hoy Resend exige un dominio propio verificado antes de poder mandar
// nada — sin esto, cada admin nuevo necesitaba que Facundo entrara a SU
// cuenta de Hostinger a mano para cargar los registros DNS que Resend
// pide, cosa que nadie más tiene permiso de tocar. Con esto, el panel:
//   1. Crea un dominio nuevo en la cuenta de Resend DE ESE ADMIN (con SU
//      propia API key, nunca la de Facundo) — resend.com/domains
//      queda igual que si lo hubiera hecho a mano ahí.
//   2. Toma los registros DNS que Resend pide (SPF/MX/DKIM/DMARC) y los
//      carga solo en escencialconsultora.com vía Hostinger (con el
//      token de cuenta de Facundo, el único que existe — el admin nunca
//      toca esa cuenta).
//   3. Dispara la verificación en Resend y expone el estado.
//
// Formato del registro MX confirmado contra un caso REAL ya existente en
// la zona (send.eneagrama, cargado a mano hace tiempo para otro
// proyecto): la prioridad va DENTRO de "content" ("10 feedback-smtp...",
// separado por espacio), Hostinger no tiene un campo aparte para eso —
// a pesar de que su propio panel web sí muestra "Priority" como campo
// visual separado.
//
// Los nombres que devuelve Resend son RELATIVOS al dominio que se
// registró (ej. "send", "_dmarc", o "@" para la raíz de ESE dominio) —
// como acá se administra la zona RAÍZ (escencialconsultora.com) vía
// Hostinger, hay que componer el nombre final anteponiendo el
// subdominio elegido (record.name "send" + subdominio "mariana" =
// "send.mariana" en la zona real).

import { escribirRegistros, type RegistroAEscribir } from './hostinger';

const DOMINIO_BASE = 'escencialconsultora.com';

async function resendFetch(apiKey: string, path: string, init?: RequestInit): Promise<Response> {
  const resp = await fetch(`https://api.resend.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!resp.ok) {
    const texto = await resp.text().catch(() => '');
    throw new Error(`Resend API respondió ${resp.status}: ${texto.slice(0, 300)}`);
  }
  return resp;
}

type RegistroResend = {
  record: string;
  name: string;
  type: string;
  ttl: string;
  status: string;
  value: string;
  priority?: number;
};

type DominioResend = {
  id: string;
  name: string;
  status: string;
  records: RegistroResend[];
};

function nombreHostingerDesdeRegistro(nombreResend: string, subdominio: string): string {
  return nombreResend === '@' ? subdominio : `${nombreResend}.${subdominio}`;
}

function contenidoDesdeRegistro(r: RegistroResend): string {
  if (r.type === 'MX') {
    const valorConPunto = r.value.endsWith('.') ? r.value : `${r.value}.`;
    return `${r.priority ?? 10} ${valorConPunto}`;
  }
  return r.value;
}

/**
 * Crea el dominio en Resend (con la key del propio admin) y carga sus
 * registros DNS en Hostinger. Devuelve el id del dominio en Resend
 * (necesario para verificar después) — no espera a que quede verificado,
 * eso es un paso aparte (verificarDominioResend), porque la propagación
 * de DNS tarda unos segundos/minutos.
 */
export async function crearDominioResend(
  apiKeyResend: string,
  subdominio: string
): Promise<{ ok: true; dominioId: string; dominioNombre: string } | { ok: false; error: string }> {
  const dominioNombre = `${subdominio}.${DOMINIO_BASE}`;
  try {
    const resp = await resendFetch(apiKeyResend, '/domains', {
      method: 'POST',
      body: JSON.stringify({ name: dominioNombre }),
    });
    const dominio: DominioResend = await resp.json();

    const registros: RegistroAEscribir[] = dominio.records.map((r) => ({
      name: nombreHostingerDesdeRegistro(r.name, subdominio),
      type: r.type,
      ttl: 14400,
      content: contenidoDesdeRegistro(r),
    }));

    await escribirRegistros(registros);

    return { ok: true, dominioId: dominio.id, dominioNombre };
  } catch (e) {
    console.error('Error creando dominio de Resend:', e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'No se pudo crear el dominio en Resend. Probá de nuevo.',
    };
  }
}

/**
 * Dispara la verificación en Resend y devuelve el estado actual. Se
 * puede llamar varias veces (botón "Verificar ahora") — Resend hace la
 * verificación real de forma asíncrona, así que puede tardar en pasar
 * de "pending" a "verified" según cuánto tarde en propagar el DNS.
 */
export async function verificarDominioResend(
  apiKeyResend: string,
  dominioId: string
): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  try {
    await resendFetch(apiKeyResend, `/domains/${dominioId}/verify`, { method: 'POST' });
    const resp = await resendFetch(apiKeyResend, `/domains/${dominioId}`);
    const dominio: DominioResend = await resp.json();
    return { ok: true, status: dominio.status };
  } catch (e) {
    console.error('Error verificando dominio de Resend:', e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'No se pudo verificar el dominio. Probá de nuevo en unos minutos.',
    };
  }
}
