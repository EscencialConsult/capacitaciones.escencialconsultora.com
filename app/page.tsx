export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-slate-800">Escencial — Plataforma de Landings</h1>
        <p className="mt-2 text-sm text-slate-500">
          Este dominio aloja landings individuales en sus propias rutas
          (ej. <code className="rounded bg-slate-100 px-1">/nombre-de-landing</code>).
        </p>
        <a
          href="/admin"
          className="mt-6 inline-block rounded-lg bg-azul px-4 py-2 text-sm font-semibold text-white hover:bg-azul-oscuro"
        >
          Ir al panel de administración
        </a>
      </div>
    </main>
  );
}
