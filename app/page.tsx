// Sin link al panel (2026-08-25, pedido explícito) — a propósito: /admin
// ya no es una URL pública (ver middleware.ts, devuelve 404 sin sesión
// activa salvo que entres por la puerta secreta), así que poner acá un
// botón "Ir al panel" delataría que existe justo a cualquiera que pise
// el dominio pelado, incluidos bots/scanners. Esta pantalla es lo único
// que hay para quien llega sin un slug de landing.
export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-one-blanco p-6">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-bold tracking-tight text-one-oscuro">Escencial — Plataforma de Landings</h1>
        <p className="mt-2 text-sm text-one-oscuro/60">
          Este dominio aloja landings individuales en sus propias rutas
          (ej. <code className="rounded-one-sm bg-one-oscuro/5 px-1.5 py-0.5">/nombre-de-landing</code>).
        </p>
      </div>
    </main>
  );
}
