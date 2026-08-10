import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

type CookieToSet = { name: string; value: string; options: CookieOptions };

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
    { auth: { persistSession: false } }
  );
}
