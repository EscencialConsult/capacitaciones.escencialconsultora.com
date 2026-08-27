import { LoginScreen } from './admin/login/LoginScreen';

// El login vive acá directo (2026-08-25, pedido explícito) — visitar el
// dominio pelado ya no muestra una pantalla intermedia, entra derecho al
// mismo formulario que /admin/login. La ofuscación sigue viva para las
// páginas de ADENTRO del panel (/admin/campaigns, etc. — ver
// middleware.ts, siguen dando 404 sin sesión activa), esto solo afecta
// dónde aparece el formulario de login en sí.
//
// mostrarRegistro=true SOLO acá (2026-08-27, pedido explícito, sin
// candado) — /admin/login no lo ofrece, "registrarse desde inicio"
// significa literal desde la raíz, no desde cualquier puerta de
// entrada al panel.
export default function HomePage() {
  return <LoginScreen mostrarRegistro />;
}
