import type { Metadata } from 'next';
import { Exo_2 } from 'next/font/google';
import './globals.css';

// Fuente única del kit ONE (aplica a cualquier producto ONE/Escencial) —
// una sola familia variando en peso, mismo criterio que sigue COMRURAL con
// Montserrat: la jerarquía se construye con peso, no con una segunda fuente.
const exo2 = Exo_2({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-exo2',
});

export const metadata: Metadata = {
  title: 'Escencial — Plataforma de Landings',
  description: 'Panel de landings y emails automatizados',
  icons: { icon: '/logos/favicon.webp' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={exo2.variable}>
      <body className="bg-one-blanco font-sans text-one-oscuro">{children}</body>
    </html>
  );
}
