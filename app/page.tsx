import { LoginScreen } from './admin/login/LoginScreen';

// El login vive acá directo (2026-08-25, pedido explícito) — visitar el
// dominio pelado ya no muestra una pantalla intermedia, entra derecho al
// mismo formulario que /admin/login. La ofuscación sigue viva para las
// páginas de ADENTRO del panel (/admin/campaigns, etc. — ver
// middleware.ts, siguen dando 404 sin sesión activa), esto solo afecta
// dónde aparece el formulario de login en sí.
export default function HomePage() {
  return <LoginScreen />;
}
