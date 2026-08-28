import Link from 'next/link';
import { MarcaForm } from '../MarcaForm';

export default function NuevaMarcaPage() {
  return (
    <div>
      <Link
        href="/admin/marcas"
        className="rounded-one-sm text-sm font-semibold text-one-fucsia transition-colors duration-150 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-one-fucsia/40"
      >
        ← Volver a marcas
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-one-oscuro">Nueva marca</h1>
      <p className="mt-1 text-sm text-one-oscuro/60">
        Se carga una sola vez — después queda disponible en el selector de &quot;Marca&quot; al crear
        una plantilla nueva, con sus colores, tipografía y logos ya resueltos en el prompt.
      </p>
      <MarcaForm />
    </div>
  );
}
