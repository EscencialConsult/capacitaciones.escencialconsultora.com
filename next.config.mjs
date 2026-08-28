/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Bug real reportado (2026-08-27) — "creo una landing y tarda en
  // aparecer en el select de Nueva campaña". Causa: el router de
  // Next.js cachea del lado del cliente hasta 30s las páginas
  // navegadas con <Link> (client-side), AUNQUE la página en sí sea
  // force-dynamic — force-dynamic solo evita el caché del lado del
  // SERVIDOR. Si creás la landing en /admin/landings y navegás sin
  // recargar a /admin/campaigns/new, ese segundo caché puede seguir
  // sirviendo la lista de antes. staleTimes.dynamic=0 lo desactiva
  // para TODO el panel — cada navegación a una página dinámica pide
  // los datos de nuevo, sin esperar ningún vencimiento de caché.
  experimental: {
    staleTimes: {
      dynamic: 0,
    },
  },
  // Logos de marcas personalizadas (2026-08-28) — viven en el bucket
  // público "marca-logos" de Supabase Storage, no en /public/ como los
  // de las 4 marcas fijas del sistema. next/image exige declarar de
  // antemano cualquier dominio externo del que sirva imágenes.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
