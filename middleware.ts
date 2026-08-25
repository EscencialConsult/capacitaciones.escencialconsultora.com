import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Único punto de entrada protegido: todo bajo /admin excepto /admin/login.
 * Un solo usuario (Facundo) — no hay roles ni tabla de permisos, alcanza
 * con "¿hay sesión válida de Supabase Auth o no?".
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith('/admin') || pathname === '/admin/login') {
    return NextResponse.next();
  }

  let cookiesParaRefrescar: CookieToSet[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesParaRefrescar = cookiesToSet;
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL('/admin/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // El layout del dashboard necesita el email para el pill de usuario del
  // header. Se lo pasamos por header del REQUEST (no de la response — eso
  // no le llega a los Server Components) para no tener que volver a
  // llamar auth.getUser() ahí adentro: esa segunda llamada (red hasta
  // Supabase en us-west-2) se repetía en CADA navegación bajo /admin/*
  // además de la que ya hace este middleware, y era la causa real de la
  // lentitud entre pantallas.
  request.headers.set('x-user-email', user.email ?? '');
  // Mismo criterio para el ícono de perfil (2026-08-24, ver Avatar.tsx) —
  // ya tenemos `user` acá con user_metadata incluido, así que agregar
  // este header es gratis (no una llamada de red nueva), a diferencia de
  // volver a pedirlo en el layout.
  const avatar = (user.user_metadata as { avatar?: string } | null)?.avatar;
  request.headers.set('x-user-avatar', avatar ?? '');

  const response = NextResponse.next({ request });
  cookiesParaRefrescar.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options)
  );

  return response;
}

export const config = {
  matcher: ['/admin/:path*'],
};
