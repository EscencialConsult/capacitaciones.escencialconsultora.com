import { LoginScreen } from './LoginScreen';

// mostrarRegistro también acá (2026-08-31, pedido explícito: "poné
// para registrarse desde el login") — antes el registro solo se
// ofrecía desde la raíz del dominio (app/page.tsx, 2026-08-27). Sigue
// siendo el mismo registro sin candado de siempre (cualquiera que
// complete el form se crea una cuenta de administrador completa, ver
// registrarAdmin en actions.ts) — esto solo agrega UN lugar más desde
// donde se llega a ese mismo formulario, no cambia el riesgo en sí.
export default function LoginPage() {
  return <LoginScreen mostrarRegistro />;
}
