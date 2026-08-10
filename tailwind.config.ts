import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        azul: '#1a4fd6',
        'azul-oscuro': '#0f2f7a',
      },
    },
  },
  plugins: [],
};

export default config;
