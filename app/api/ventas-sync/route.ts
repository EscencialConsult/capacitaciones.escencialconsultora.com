import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { limpiarEmailCrm } from '@/lib/leads-import';
import { registrarAlerta } from '@/lib/email/process-pending';

/**
 * Sync automático de ventas (2026-08-31, pedido explícito: "debe ser de
 * un modo automático") — recibe la planilla de ventas completa, mandada
 * por un Apps Script instalado en una hoja de Google Sheets (no importa
 * si es la original o una copia armada con IMPORTRANGE — Facundo no es
 * dueño de la original, así que arma la suya propia con IMPORTRANGE,
 * que es de solo lectura hacia la fuente, y el Apps Script va sobre esa
 * copia). Cada fila que matchea por email contra un lead existente (en
 * CUALQUIER campaña, ver marcar_vendidos_por_email_global) se marca
 * vendida y se le cancela lo que le quedaba pendiente de mandar.
 *
 * Formato del body — igual a lo que manda getDataRange().getValues() de
 * Apps Script serializado con JSON.stringify: la primera fila son los
 * encabezados reales de la planilla (los que sean, no se asume ningún
 * formato fijo), el resto son los datos. Mismo criterio que
 * MarcarVendidosButton.tsx: adivina la columna de email por el texto
 * del encabezado en vez de asumir una posición fija.
 *
 * Autenticación: token compartido en vez de sesión — quien llama acá es
 * un Apps Script, no un browser logueado. Sin esto, cualquiera que
 * adivine la URL podría marcar leads como vendidos (cancela emails
 * agendados — no es un GET inocuo). El token vive en VENTAS_SYNC_TOKEN.
 */
const bodySchema = z.object({
  datos: z.array(z.array(z.unknown())).max(20000, 'Demasiadas filas en un solo envío.'),
});

const PISTA_EMAIL = /correo|e-?mail/i;

export async function POST(request: Request) {
  const tokenEsperado = process.env.VENTAS_SYNC_TOKEN;
  if (!tokenEsperado) {
    console.error('VENTAS_SYNC_TOKEN no está configurado — el sync de ventas no puede autenticar nada.');
    return NextResponse.json({ ok: false, error: 'No configurado.' }, { status: 500 });
  }

  const tokenRecibido =
    request.headers.get('x-ventas-sync-token') ?? new URL(request.url).searchParams.get('token');
  if (tokenRecibido !== tokenEsperado) {
    return NextResponse.json({ ok: false, error: 'No autorizado.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Body inválido.' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' },
      { status: 400 }
    );
  }

  const filas = parsed.data.datos;
  const supabase = createSupabaseServiceClient();

  if (filas.length < 2) {
    // Solo encabezado (o vacío) — no es un error, puede ser la primera
    // corrida sobre una planilla todavía sin filas de datos.
    return NextResponse.json({ ok: true, marcados: 0, encontrados: 0 });
  }

  const [encabezados, ...resto] = filas;
  const idxEmail = encabezados.findIndex((h) => PISTA_EMAIL.test(String(h ?? '')));

  if (idxEmail < 0) {
    await registrarAlerta(
      supabase,
      'ventas_sync_sin_columna_email',
      `El sync de ventas recibió ${filas.length} filas pero ninguna columna de encabezado matchea "email"/"correo". Encabezados recibidos: ${encabezados.map((h) => String(h ?? '')).join(', ')}`
    );
    return NextResponse.json({ ok: false, error: 'No se encontró una columna de email en el encabezado.' }, { status: 422 });
  }

  const emails = Array.from(
    new Set(
      resto
        .map((fila) => limpiarEmailCrm(fila[idxEmail]))
        .filter((e): e is string => !!e)
        .map((e) => e.toLowerCase())
    )
  );

  if (emails.length === 0) {
    await registrarAlerta(
      supabase,
      'ventas_sync_sin_emails_validos',
      `El sync de ventas recibió ${resto.length} filas de datos pero ninguna tiene un email válido en la columna "${encabezados[idxEmail]}".`
    );
    return NextResponse.json({ ok: true, marcados: 0, encontrados: 0 });
  }

  const { data, error } = await supabase.rpc('marcar_vendidos_por_email_global', { p_emails: emails });

  if (error || !data) {
    console.error('Error en marcar_vendidos_por_email_global:', error);
    await registrarAlerta(supabase, 'ventas_sync_error_rpc', `Falló marcar_vendidos_por_email_global: ${error?.message}`);
    return NextResponse.json({ ok: false, error: 'No se pudo procesar el sync.' }, { status: 500 });
  }

  const r = data as { marcados: number; encontrados: number };
  return NextResponse.json({ ok: true, totalEmails: emails.length, ...r });
}
