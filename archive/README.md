# Sistema viejo — Sheets + Apps Script (archivado)

Este sistema **quedó descartado el 2026-08-10**, reemplazado por una
plataforma nueva (Next.js + Supabase) pensada para manejar cientos de
landings en simultáneo desde un panel de administración, en vez de una
Google Sheet editada a mano por campaña.

Se conserva acá como referencia histórica — no se borra porque:
- Documenta decisiones de diseño que siguen siendo válidas conceptualmente
  en el sistema nuevo (separar config de leads, no romper campañas en
  curso, nunca comprometer secretos a git).
- El template de email (`templates-email/design-base-1/email.html`) se
  migra tal cual como primer seed de la tabla `email_templates`.

**No se sigue desarrollando ni deployando nada de acá.** Para el sistema
actual, ver el `README.md` de la raíz del repo.
