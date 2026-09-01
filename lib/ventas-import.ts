import type { createSupabaseServiceClient } from '@/lib/supabase/server';
import { limpiarValorCrm, limpiarEmailCrm } from '@/lib/leads-import';
import { palabrasComunes, mismoNombre, ultimosDigitos, fechaDentroDeVentana } from '@/lib/ventas-matching';

type SupabaseServiceClient = ReturnType<typeof createSupabaseServiceClient>;

/**
 * Ingesta + matcheo de la planilla de ventas (2026-09-01, ver migración
 * 0036) — llamado desde app/api/ventas-sync/route.ts. Ya NO marca nada
 * solo: cada fila nueva entra a la tabla `ventas` como 'pendiente', con
 * una sugerencia de lead/campaña si el motor encontró algo razonable —
 * Facundo confirma o rechaza desde /admin/ventas.
 */

// Encabezados reales de "VENTAS 2025 - 2026 (respuestas)" (confirmados
// por Facundo, 2026-09-01) — exactos donde hace falta (ej. "nombre" a
// secas, para no matchear "NOMBRE DE CAMPAÑA PUBLICITARIA" que también
// contiene esa palabra).
const PISTAS = {
  marcaTemporal: /^marca\s*temporal$/i,
  nombre: /^nombres?$/i,
  apellido: /^apellidos?$/i,
  dni: /^dni$/i,
  celular: /^celular$/i,
  email: /^correo$/i,
  programa: /^programa$/i,
  origen: /^origen$/i,
  monto: /^valor\s*pagado$/i,
};

export type VentaCruda = {
  marcaTemporal: Date;
  nombre: string | null;
  apellido: string | null;
  dni: string | null;
  email: string | null;
  celular: string | null;
  programa: string | null;
  origen: string | null;
  monto: string | null;
  raw: Record<string, string>;
};

/**
 * "23/06/2026 15:37:28" (DD/MM/YYYY HH:MM:SS, formato de Google Forms
 * en es-AR) → Date real en UTC. Se arma con Date.UTC en vez de
 * new Date(y,m,d,...) a propósito — esto último interpreta los
 * componentes en el huso horario LOCAL del proceso que corre el código
 * (en Netlify, no necesariamente Argentina), lo que corría la hora sin
 * avisar. Argentina no tiene horario de verano (UTC-3 fijo todo el
 * año), así que sumar 3 horas es exacto, no una aproximación.
 */
function parsearMarcaTemporal(valor: string): Date | null {
  const m = valor.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh, min, ss] = m;
  const fecha = new Date(
    Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh) + 3, Number(min), ss ? Number(ss) : 0)
  );
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/** Parsea las filas crudas de la planilla (encabezado + datos) a VentaCruda[], salteando las que no tienen una Marca temporal parseable (sin eso no hay clave de dedupe posible). */
export function parsearFilasVentas(
  encabezados: string[],
  filas: unknown[][]
): { ventas: VentaCruda[]; sinFecha: number; columnasFaltantes: string[] } {
  const idx = Object.fromEntries(
    Object.entries(PISTAS).map(([campo, regex]) => [campo, encabezados.findIndex((h) => regex.test(String(h ?? '').trim()))])
  ) as Record<keyof typeof PISTAS, number>;

  const columnasFaltantes = Object.entries(idx)
    .filter(([, i]) => i < 0)
    .map(([campo]) => campo);

  const ventas: VentaCruda[] = [];
  let sinFecha = 0;

  for (const fila of filas) {
    const crudaFecha = idx.marcaTemporal >= 0 ? String(fila[idx.marcaTemporal] ?? '') : '';
    const marcaTemporal = parsearMarcaTemporal(crudaFecha);
    if (!marcaTemporal) {
      sinFecha++;
      continue;
    }

    const raw: Record<string, string> = {};
    encabezados.forEach((h, i) => {
      const v = fila[i];
      if (v != null && String(v).trim() !== '') raw[h] = String(v);
    });

    ventas.push({
      marcaTemporal,
      nombre: idx.nombre >= 0 ? limpiarValorCrm(fila[idx.nombre]) : null,
      apellido: idx.apellido >= 0 ? limpiarValorCrm(fila[idx.apellido]) : null,
      dni: idx.dni >= 0 ? limpiarValorCrm(fila[idx.dni]) : null,
      email: idx.email >= 0 ? limpiarEmailCrm(fila[idx.email]) : null,
      celular: idx.celular >= 0 ? limpiarValorCrm(fila[idx.celular]) : null,
      programa: idx.programa >= 0 ? limpiarValorCrm(fila[idx.programa]) : null,
      origen: idx.origen >= 0 ? limpiarValorCrm(fila[idx.origen]) : null,
      monto: idx.monto >= 0 ? limpiarValorCrm(fila[idx.monto]) : null,
      raw,
    });
  }

  return { ventas, sinFecha, columnasFaltantes };
}

export type ResultadoMatch = { leadId: string | null; campaignId: string | null; senales: string[] };

/**
 * El motor de sugerencias, en orden de confianza — ver el comentario
 * largo en la migración 0036 para el porqué de este orden y de acotar
 * el matcheo por nombre a una campaña ya filtrada por tema+fecha, en
 * vez de compararlo contra toda la base.
 */
export async function matchearVenta(supabase: SupabaseServiceClient, venta: VentaCruda): Promise<ResultadoMatch> {
  // 1. Email exacto.
  if (venta.email) {
    const { data } = await supabase
      .from('leads')
      .select('id, campaign_id')
      .not('email', 'is', null)
      .ilike('email', venta.email)
      .limit(1)
      .maybeSingle();
    if (data) return { leadId: data.id, campaignId: data.campaign_id, senales: ['email'] };
  }

  // 2. Teléfono, por sufijo (últimos 8 dígitos) — ver buscar_leads_por_telefono.
  // Ambiguo (más de un candidato) = mejor no sugerir que sugerir mal.
  if (venta.celular) {
    const sufijo = ultimosDigitos(venta.celular, 8);
    if (sufijo) {
      const { data } = await supabase.rpc('buscar_leads_por_telefono', { p_sufijo: sufijo });
      if (data && data.length === 1) {
        return { leadId: data[0].id, campaignId: data[0].campaign_id, senales: ['telefono'] };
      }
    }
  }

  // 3. Tema (palabras clave de "Programa" vs. nombre de campaña) + fecha
  // (¿la venta cayó dentro de la ventana en que esa campaña estuvo
  // activa?) — y RECIÉN ahí, nombre+apellido, pero solo entre los leads
  // de esa campaña puntual, nunca de toda la base.
  if (venta.programa && venta.nombre && venta.apellido) {
    const { data: campanas } = await supabase
      .from('campaigns')
      .select('id, name, activated_at, deactivated_at')
      .not('activated_at', 'is', null);

    const candidatas = (campanas ?? [])
      .filter((c) => fechaDentroDeVentana(venta.marcaTemporal, c.activated_at, c.deactivated_at))
      .map((c) => ({ ...c, puntaje: palabrasComunes(c.name, venta.programa!) }))
      .filter((c) => c.puntaje > 0)
      .sort((a, b) => b.puntaje - a.puntaje)
      .slice(0, 3);

    for (const candidata of candidatas) {
      const { data: leadsDeCampana } = await supabase
        .from('leads')
        .select('id, first_name, last_name')
        .eq('campaign_id', candidata.id);

      const match = (leadsDeCampana ?? []).find(
        (l) => l.first_name && l.last_name && mismoNombre(l.first_name, l.last_name, venta.nombre!, venta.apellido!)
      );
      if (match) {
        return { leadId: match.id, campaignId: candidata.id, senales: ['tema', 'fecha', 'nombre'] };
      }
    }
  }

  return { leadId: null, campaignId: null, senales: [] };
}

// Tope defensivo por corrida (2026-09-01) — la primera vez que se
// conecta esto puede haber un backlog grande (la planilla de Facundo
// ya traía ~1300 filas desde donde arrancó el IMPORTRANGE). Sin este
// tope, procesar todo de una podría acercarse al límite de tiempo de
// una función de Netlify. No hace falta más que esto: cada corrida
// retoma exactamente donde quedó la anterior (ver "desde" más abajo,
// ordenado por marca_temporal), así que el backlog se termina de
// procesar solo en las próximas corridas del activador cada 1 hora,
// sin perder ni duplicar ninguna fila.
const LIMITE_FILAS_POR_CORRIDA = 200;

export type ResumenIngesta = {
  nuevas: number;
  sinFecha: number;
  columnasFaltantes: string[];
  senales: { email: number; telefono: number; tema: number; sinMatch: number };
  pendientesRestantes: number;
};

/** Orquesta todo: filtra lo ya conocido, matchea lo nuevo, inserta. */
export async function ingerirVentas(
  supabase: SupabaseServiceClient,
  encabezados: string[],
  filas: unknown[][]
): Promise<ResumenIngesta> {
  const { ventas, sinFecha, columnasFaltantes } = parsearFilasVentas(encabezados, filas);

  // La planilla es cronológica (Google Forms agrega cada respuesta al
  // final) — con la última marca_temporal ya conocida alcanza para
  // saber qué es nuevo, sin tener que chequear fila por fila contra la
  // base.
  const { data: ultima } = await supabase
    .from('ventas')
    .select('marca_temporal')
    .order('marca_temporal', { ascending: false })
    .limit(1)
    .maybeSingle();
  const desde = ultima ? new Date(ultima.marca_temporal) : null;

  const nuevasOrdenadas = ventas
    .filter((v) => !desde || v.marcaTemporal > desde)
    .sort((a, b) => a.marcaTemporal.getTime() - b.marcaTemporal.getTime());

  const aProcesar = nuevasOrdenadas.slice(0, LIMITE_FILAS_POR_CORRIDA);
  const senales = { email: 0, telefono: 0, tema: 0, sinMatch: 0 };

  for (const venta of aProcesar) {
    const match = await matchearVenta(supabase, venta);

    if (match.senales.includes('email')) senales.email++;
    else if (match.senales.includes('telefono')) senales.telefono++;
    else if (match.senales.includes('tema')) senales.tema++;
    else senales.sinMatch++;

    const { error } = await supabase.from('ventas').insert({
      marca_temporal: venta.marcaTemporal.toISOString(),
      nombre: venta.nombre,
      apellido: venta.apellido,
      dni: venta.dni,
      email: venta.email,
      celular: venta.celular,
      programa: venta.programa,
      origen: venta.origen,
      monto: venta.monto,
      raw: venta.raw,
      lead_id_sugerido: match.leadId,
      campaign_id_sugerido: match.campaignId,
      senales: match.senales,
    });
    // unique_violation en marca_temporal = otra corrida concurrente ya
    // la insertó justo antes — no es un error real, se ignora.
    if (error && error.code !== '23505') {
      console.error('Error insertando venta:', error);
    }
  }

  return {
    nuevas: aProcesar.length,
    sinFecha,
    columnasFaltantes,
    senales,
    pendientesRestantes: Math.max(0, nuevasOrdenadas.length - aProcesar.length),
  };
}
