import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { ingerirVentas } from '@/lib/ventas-import';
import { registrarAlerta } from '@/lib/email/process-pending';

/**
 * Sync automático de ventas (2026-08-31/09-01, pedido explícito) —
 * recibe la planilla de ventas completa, mandada por un Apps Script
 * instalado en una hoja de Google Sheets propia de Facundo (mirror de
 * solo lectura de la original vía IMPORTRANGE — no es dueño de la
 * original). Ya NO marca nada solo (ver migración 0036, reemplaza el
 * comportamiento de la migración 0035): cada fila nueva entra a la
 * cola de revisión `ventas`, con una sugerencia de lead/campaña si el
 * motor de lib/ventas-import.ts encontró algo razonable — la
 * confirmación real (marcar vendido, cancelar lo pendiente) pasa por
 * /admin/ventas, a mano.
 *
 * Formato del body — igual a lo que manda getDataRange().getValues()
 * de Apps Script serializado con JSON.stringify: la primera fila son
 * los encabezados reales de la planilla, el resto son los datos.
 *
 * Autenticación: token compartido en vez de sesión — quien llama acá
 * es un Apps Script, no un browser logueado. El token vive en
 * VENTAS_SYNC_TOKEN.
 */
const bodySchema = z.object({
  datos: z.array(z.array(z.unknown())).max(20000, 'Demasiadas filas en un solo envío.'),
});

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
    return NextResponse.json({ ok: true, nuevas: 0 });
  }

  const [encabezados, ...resto] = filas;
  const encabezadosTexto = encabezados.map((h) => String(h ?? ''));

  const resumen = await ingerirVentas(supabase, encabezadosTexto, resto);

  if (resumen.columnasFaltantes.length > 0) {
    await registrarAlerta(
      supabase,
      'ventas_sync_columnas_faltantes',
      `El sync de ventas no encontró estas columnas esperadas en el encabezado: ${resumen.columnasFaltantes.join(', ')}. Encabezados recibidos: ${encabezadosTexto.join(', ')}`
    );
  }
  if (resumen.sinFecha > 0) {
    await registrarAlerta(
      supabase,
      'ventas_sync_filas_sin_fecha',
      `El sync de ventas encontró ${resumen.sinFecha} filas sin una "Marca temporal" interpretable — se saltearon (no hay clave de dedupe sin fecha).`
    );
  }

  return NextResponse.json({ ok: true, ...resumen });
}
