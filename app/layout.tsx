import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Escencial — Plataforma de Landings',
  description: 'Panel de landings y emails automatizados',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
