import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Colores viejos — se mantienen hasta terminar de migrar el resto
        // de las pantallas (landings, plantillas, etc.) al kit ONE.
        azul: '#1a4fd6',
        'azul-oscuro': '#0f2f7a',

        // Kit de marca ONE (aplica a cualquier producto ONE/Escencial —
        // ver cerebro-facundo/proyectos/plataforma-one/wiki/ONE-kit-de-marca.md).
        'one-negro': '#000000',
        'one-oscuro': '#1a181d',
        'one-blanco': '#fefeff',
        'one-fucsia': '#e17bd7',
        'one-cian': '#6be1e3',
        'one-dorado': '#e4c76a',
        'one-lavanda': '#a4a8c0',
        'one-gris-claro': '#c6c9d7',
        // No definido en el kit — rojo estándar accesible para errores,
        // pendiente de confirmar con Facundo si se agrega al kit oficial.
        'one-rojo': '#e2445c',
      },
      fontFamily: {
        sans: ['var(--font-exo2)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        // Nombres propios (no pisan rounded-sm/md/lg default) para no
        // afectar las pantallas viejas que todavía no se rediseñaron.
        'one-sm': '8px',
        'one-md': '16px',
        'one-lg': '24px',
      },
      boxShadow: {
        // Sistema de elevación del panel admin (2026-08-24, rediseño) —
        // sombras teñidas de one-oscuro (no gris/negro puro) para que se
        // sientan parte de la marca, no un shadow por default de librería.
        // Tres escalones nada más: reposo casi imperceptible, hover con
        // intención, modal/popover que necesita separarse del fondo de
        // verdad. Nunca una sombra grande en estado idle (ver skill
        // anti-ia) — el salto de "sm" a "md" es lo que comunica interacción.
        'one-sm': '0 1px 2px rgba(26,24,29,0.04), 0 1px 1px rgba(26,24,29,0.03)',
        'one-md': '0 12px 24px -8px rgba(26,24,29,0.16), 0 4px 8px -4px rgba(26,24,29,0.08)',
        'one-lg': '0 24px 48px -12px rgba(26,24,29,0.28), 0 8px 16px -4px rgba(26,24,29,0.12)',
        // Único uso de sombra con color de marca (no neutra) — reservado
        // para el elemento más importante de una pantalla (CTA principal
        // en foco, tarjeta seleccionada), nunca en un grid completo.
        'one-fucsia': '0 12px 28px -8px rgba(225,123,215,0.35)',
      },
      backgroundImage: {
        // Textura de fondo sutil para el shell del panel (ver layout.tsx)
        // — mismo criterio que SISTEMA_DISENO_LANDING usa para las
        // landings públicas (lib/landing-template-defaults.ts): puntos
        // finos a opacidad casi nula, para que el fondo blanco plano no
        // se sienta genérico, sin competir nunca con el contenido real.
        'one-dots': 'radial-gradient(circle, rgba(26,24,29,0.08) 1px, transparent 1px)',
      },
      backgroundSize: {
        // Nombre distinto de backgroundImage.one-dots a propósito — Tailwind
        // genera la clase de tamaño como bg-<key> igual que la de imagen, así
        // que compartir el mismo nombre las hacía colisionar (ambas
        // "bg-one-dots", el linter las marcaba como conflicto real).
        'one-dots-size': '22px 22px',
      },
    },
  },
  plugins: [],
};

export default config;
