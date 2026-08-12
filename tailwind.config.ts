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
    },
  },
  plugins: [],
};

export default config;
