'use client';

import { TriangleAlert } from 'lucide-react';

// Boundary de error (Next.js App Router) para cualquier página bajo
// /admin/* — antes no existía ninguno, así que una excepción real en un
// Server Component (fallo de red a Supabase, un dato con una forma
// inesperada, etc.) se propagaba hasta el manejador de error por defecto
// de Next.js y reemplazaba TODA la pantalla, incluido el sidebar/header
// que layout.tsx arma por fuera de este boundary. Mismo criterio visual
// que loading.tsx: acá solo se reemplaza el área de contenido, el
// sidebar y el header quedan intactos.
export default function ErrorAdmin({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="stagger-in flex flex-col items-center rounded-one-lg bg-one-blanco p-10 text-center shadow-one-sm">
      <div className="flex size-12 items-center justify-center rounded-full bg-one-rojo/10">
        <TriangleAlert className="size-6 text-one-rojo" strokeWidth={2} />
      </div>
      <p className="mt-4 text-base font-extrabold text-one-oscuro">Algo falló cargando esta pantalla.</p>
      <p className="mt-2 max-w-sm text-sm text-one-oscuro/60">{error.message}</p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 rounded-full bg-one-fucsia px-6 py-2.5 text-sm font-bold text-one-negro transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-one-md"
      >
        Reintentar
      </button>
    </div>
  );
}
