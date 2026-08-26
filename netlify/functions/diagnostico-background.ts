import { createClient } from '@supabase/supabase-js';

/**
 * Diagnóstico temporal (2026-08-26) — confirma si una función
 * "background" mínima (sin la lógica de process-pending.ts) puede
 * terminar y escribir su resultado en Supabase, para aislar si el
 * problema es de red del entorno background en sí (Supabase, fetch
 * externo) o algo puntual de la lógica de envío. Borrar una vez
 * resuelto.
 */
export default async () => {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const pasos: string[] = [];
  const inicio = Date.now();

  const registrar = async (texto: string) => {
    pasos.push(`${texto} (${Date.now() - inicio}ms)`);
    await supabase.from('system_alerts').upsert(
      { source: 'diagnostico_background', message: pasos.join(' | '), last_seen_at: new Date().toISOString(), resolved_at: null },
      { onConflict: 'source' }
    );
  };

  await registrar('arrancó');

  try {
    const resp = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: 'Bearer test-invalido' },
    });
    await registrar(`fetch a Resend respondió ${resp.status}`);
  } catch (err) {
    await registrar(`fetch a Resend falló: ${err instanceof Error ? err.message : String(err)}`);
  }

  await registrar('terminó');
};
