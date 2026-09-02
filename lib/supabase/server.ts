import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Bug real confirmado en producción (2026-09-02) — una landing recién
// creada (con is_active/campaña activa correctos en la base, verificado
// a mano) seguía devolviendo 404 "todavía no tiene ninguna campaña
// activa" un buen rato después de activarla, en TODAS sus formas de
// acceso (path clásico y subdominio propio). `export const dynamic =
// 'force-dynamic'` en app/[slug]/route.ts ya estaba puesto, pero el
// runtime de Next.js en Netlify (@netlify/plugin-nextjs) intercepta
// automáticamente cada `fetch()` — incluido el que usa @supabase/
// supabase-js por debajo — con su propia caché durable (Netlify Blobs),
// una capa AL MARGEN de si el segmento de ruta está marcado dinámico.
// El síntoma coincidía exacto con la ventana real: la landing quedó
// pública (subdominio ya publicado) unos 27 minutos ANTES de activar
// su campaña — el primer 404 (legítimo en ese momento) quedó cacheado
// ahí y nunca se refrescó solo. Un rebuild con caché limpia lo arregló
// una vez, pero eso no evita que le pase a la PRÓXIMA landing nueva.
// Fix real: pasarle a los dos clientes un fetch propio que siempre
// pide 'no-store' — ninguna capa de caché (Next.js ni la de Netlify)
// puede interceptar algo que ya viene marcado así desde el pedido.
function fetchSinCache(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, { ...init, cache: 'no-store' });
}

/**
 * Cliente de Supabase para usar en Server Components, Route Handlers y
 * Server Actions — respeta la sesión del usuario logueado (RLS activo,
 * sin permisos elevados). Para leer datos protegidos usá este cliente
 * dentro de una ruta ya envuelta por el middleware de /admin.
 */
export function createSupabaseServerClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: fetchSinCache },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Se llama desde un Server Component sin poder escribir cookies
            // (pasa en algunos renders) — el middleware ya se encarga de
            // refrescar la sesión, esto es seguro de ignorar acá.
          }
        },
      },
    }
  );
}

/**
 * Chequeo de sesión propio para Server Actions mutantes (2026-08-24,
 * bug real confirmado) — hasta ahora la ÚNICA protección de esas
 * funciones era que middleware.ts hubiera interceptado la URL exacta
 * desde la que se invocan. Las tablas tienen RLS activado pero CERO
 * policies (ver supabase/migrations/0001_init.sql), así que sin sesión
 * y sin este chequeo, cualquier código que termine llamando a una
 * Server Action fuera del árbol /admin/(dashboard) —por un cambio
 * futuro en el matcher del middleware, por ejemplo— quedaría con
 * lectura/escritura total vía service role. Se llama como primera
 * línea de cada Server Action que inserta/actualiza/borra algo; devuelve
 * el user si hay sesión válida, o null si no.
 */
export async function requireAdmin() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

/**
 * Cliente con la SERVICE ROLE KEY — bypassea RLS por completo. Úsalo
 * SOLO en Route Handlers/Server Actions que ya validaron lo que hace
 * falta a mano (ej. el endpoint público de captura de leads, que no
 * tiene sesión de usuario pero necesita poder escribir en la tabla).
 * Nunca lo importes en un componente que se renderiza en el cliente.
 */
export function createSupabaseServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false }, global: { fetch: fetchSinCache } }
  );
}
