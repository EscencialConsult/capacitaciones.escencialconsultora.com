// Se muestra automáticamente (Next.js App Router) mientras carga
// cualquier página bajo /admin/* — antes no había ninguno acá, así que
// una navegación sin datos todavía en caché no mostraba nada hasta que
// la página nueva terminaba de renderizar del todo: se sentía "trabada"
// en vez de "cargando". El sidebar/header no se re-renderizan (viven en
// layout.tsx, fuera de este boundary), solo el área de contenido.
//
// Rediseño 2026-08-24 (DESIGN.md) — .skeleton-shimmer (ver globals.css)
// en vez de solo animate-pulse: un barrido de brillo real en vez de
// opacidad subiendo/bajando, se siente "cargando de verdad" en vez de
// "placeholder roto". Anima `transform`, no `background-position` — barato
// en el compositor de la GPU incluso en el primer render de la sesión.
export default function CargandoAdmin() {
  return (
    <div className="space-y-6">
      <div className="skeleton-shimmer h-7 w-48 rounded-one-sm" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="skeleton-shimmer h-24 rounded-one-lg" />
        <div className="skeleton-shimmer h-24 rounded-one-lg" />
        <div className="skeleton-shimmer h-24 rounded-one-lg" />
        <div className="skeleton-shimmer h-24 rounded-one-lg" />
      </div>
      <div className="skeleton-shimmer h-64 rounded-one-lg" />
    </div>
  );
}
