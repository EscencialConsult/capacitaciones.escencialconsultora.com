# Landing Automatizada con Envío de Emails y Confirmación de Contacto

Sistema de landings conectadas a Google Sheets + Apps Script + Brevo, con
hasta 4 emails de seguimiento por lead, tracking del click en WhatsApp, y
un dashboard de estado. Plan de trabajo completo en `docs/` (basado en el
documento original de Agosto 2026).

**Publicado en:** `capacitaciones.escencialconsultora.com` (landing en `/`,
dashboard de estado en `/dashboard`) — ver `docs/setup-hosting.md`.

## Arquitectura

```
Landing (HTML/JS) → doPost → Apps Script Web App → Google Sheets: pestaña única "Datos"
                                    │                  (bloque Leads A:Q + bloque Config_Campañas S:AM)
                          trigger horario (1h)
                                    ▼
                          Script B (Enviador) → Brevo API → email al lead
                                                                  │
                                                     click en botón WhatsApp
                                                                  ▼
                                                     doGet (Tracker) → guarda click → wa.me

Dashboard (HTML/JS, en /dashboard) → doGet(?vista=dashboard&clave=...) → JSON con el estado de cada campaña
```

Plantillas de email: HTML versionado en GitHub (URL fija, se actualiza
sobreescribiendo el mismo archivo — nunca cambia el link).

Google Sheets: **una sola pestaña** (`Datos`), no tres. Adentro conviven
dos bloques de columnas — Leads (A:Q) y Config_Campañas (S:AM) — separados
por una columna vacía, para no perder la separación entre "datos de
personas" y "configuración de campaña" (que es lo que permite reutilizar
una campaña sin duplicar nada) sin necesitar pestañas distintas. Ver
`docs/setup-sheets.md` para el detalle exacto.

## Estructura de este repo

```
index.html                → landing (HTML/JS puro), publicada en la raíz del dominio (/)
dashboard/                → panel de estado (HTML/JS puro), publicado en /dashboard
apps-script/              → Code.gs (Receptor + Enviador + Tracker + endpoint del dashboard, un solo archivo), appsscript.json
templates-email/          → diseños base reutilizables (URL fija en este mismo repo)
docs/
  setup-sheets.md         → una sola pestaña "Datos", con las columnas exactas de cada bloque
  setup-brevo.md          → cuenta, dominio, API key
  setup-hosting.md         → publicar en Netlify + conectar el dominio + verificar Brevo (dos DNS separados)
  checklist-implementacion.md → paso a paso para dejarlo funcionando hoy
```

## Decisiones tomadas

- **API de email: Brevo** (no Resend) — más volumen gratuito para varias
  campañas con 4 envíos por lead.
- **Una sola cuenta de Brevo para todo el proyecto**, no una por landing
  (dominio verificado y reputación de envío no conviene fragmentarlos).
- **Una sola pestaña de Sheets** (`Datos`) con dos bloques de columnas, en
  vez de pestañas separadas — decisión de Facundo para tener todo a la
  vista en un solo lugar.
- **Un solo archivo `Code.gs`** en Apps Script, en vez de varios `.gs`
  separados por responsabilidad — mismo criterio de simplicidad.
- **Repo conectado a GitHub** en `EscencialConsult/capacitaciones.escencialconsultora.com`,
  pensado para publicarse en Netlify apuntando al dominio del mismo nombre.
- **Dashboard protegido con clave**, no con login de Google — el Web App
  de Apps Script tiene que ser público (`Cualquier usuario`) para que la
  landing y el tracker de WhatsApp funcionen sin fricción, así que el
  dashboard usa una clave (`DASHBOARD_SECRET`) que el navegador guarda
  local y nunca queda escrita en el código público.

## Próximo paso

Seguir `docs/checklist-implementacion.md` de punta a punta para tener el
primer flujo de prueba funcionando (landing → Sheets → email → WhatsApp →
dashboard) y después publicarlo con `docs/setup-hosting.md`.
