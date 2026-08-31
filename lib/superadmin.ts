// Rol de superadmin (2026-08-31, pedido explícito) — hasta ahora
// TODOS los que entraban al panel (con sesión real) tenían exactamente
// el mismo acceso, sin distinción de rol. Eso funcionaba mientras la
// única config "de toda la plataforma, no de un admin puntual" era
// texto en el chat con Claude (tokens de Hostinger/Netlify) — pero la
// configuración de Google OAuth (Client ID/Secret) necesita vivir EN EL
// PANEL para que quede documentada ahí (ver /admin/superadmin), y eso
// no puede ser visible/editable por cualquier admin.
//
// Implementación deliberadamente liviana: una lista de emails en una
// variable de entorno (mismo criterio que ADMIN_SECRET_PATH,
// INTERNAL_FUNCTION_SECRET, etc. — un valor de configuración, no una
// tabla nueva con su propio CRUD) — no hay "roles" en la base, ni un
// campo is_superadmin en ningún lado. Si hace falta un sistema de roles
// más completo en el futuro (varios niveles, asignable desde el panel),
// esto es el lugar para reemplazar, no para parchear.
export function esSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const lista = (process.env.SUPERADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return lista.includes(email.toLowerCase());
}
