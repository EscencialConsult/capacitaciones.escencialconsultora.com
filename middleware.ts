import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Puerta de entrada ofuscada (2026-08-25, pedido explícito) — /admin
 * literal ya no es una URL pública: pisarlo directo sin sesión activa
 * devuelve 404 liso, ni rastro de que hay un panel atrás (nada de
 * redirect a un login que confirmaría que la ruta existe). La única
 * forma real de entrar es por /<ADMIN_SECRET_PATH>/login, que este
 * middleware reescribe por dentro a /admin/login sin que la barra de
 * direcciones lo note. Una vez adentro (sesión real de Supabase), toda
 * la navegación interna sigue funcionando con las rutas /admin/... de
 * siempre — no hubo que tocar ni un link ni un redirect() de las ~30
 * páginas/acciones que ya las usan, el cambio queda contenido acá.
 *
 * Ojo con el trade-off: si la sesión expira en medio de la navegación,
 * el próximo click a algo bajo /admin también da 404 en vez de mandar
 * a un login — es la única forma de no filtrarle la URL secreta a
 * cualquiera que la adivine (un redirect con el secreto en el Location
 * lo expondría). El arreglo en ese caso es simple: volver a entrar por
 * el link guardado.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const secreto = process.env.ADMIN_SECRET_PATH;

  let pathDestino = pathname;
  let vinoPorElSecreto = false;

  if (secreto && (pathname === `/${secreto}` || pathname.startsWith(`/${secreto}/`))) {
    const resto = pathname.slice(`/${secreto}`.length);
    pathDestino = `/admin${resto}`;
    vinoPorElSecreto = true;
  }

  // La raíz del dominio (2026-08-25, pedido explícito) ya renderiza el
  // mismo formulario de login (ver app/page.tsx) — acá solo hace falta
  // el atajo de cortesía: si ya hay sesión activa, directo al panel en
  // vez de mostrar el form de nuevo. Sin sesión, sigue de largo y listo
  // (nunca 404 — a diferencia de /admin, la raíz es la puerta pública).
  const esRaiz = pathDestino === '/';

  if (pathDestino !== '/admin' && !pathDestino.startsWith('/admin/') && !esRaiz) {
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

  if (esRaiz) {
    const response = user
      ? NextResponse.redirect(new URL('/admin', request.url))
      : NextResponse.next({ request });
    cookiesParaRefrescar.forEach(({ name, value, options }) =>
      response.cookies.set(name, value, options)
    );
    return response;
  }

  const esLogin = pathDestino === '/admin/login';

  if (!user) {
    // Sin sesión: solo se deja pasar si llegó por el secreto — cualquier
    // otra cosa (incluido /admin/login pisado directo) es 404, para que
    // ni siquiera se note que existe un formulario de login ahí.
    if (!vinoPorElSecreto) {
      return new NextResponse(null, { status: 404 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    return NextResponse.rewrite(url);
  }

  // Hay sesión real — si vino por /admin/login (típico: alguien que ya
  // estaba logueado volvió a esa URL) lo mandamos derecho al dashboard,
  // mismo criterio de siempre.
  if (esLogin) {
    return NextResponse.redirect(new URL('/admin', request.url));
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

  const url = request.nextUrl.clone();
  url.pathname = pathDestino;
  const response = vinoPorElSecreto
    ? NextResponse.rewrite(url, { request })
    : NextResponse.next({ request });
  cookiesParaRefrescar.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options)
  );

  return response;
}

export const config = {
  // No se puede armar este matcher con la variable de entorno (Next.js
  // necesita un valor estático acá, se resuelve en build) — por eso
  // matchea TODO y el filtro real de qué es "/admin" pasa adentro de la
  // función, comparando pathDestino después de la posible reescritura.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logos/).*)'],
};
