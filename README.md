# Escencial — Plataforma de Landings + Emails

Plataforma que reemplaza al sistema original de Sheets/Apps Script (ver
`archive/`) para poder manejar muchas landings en simultáneo desde un
panel de administración central, en vez de una planilla por campaña.

**Publicado en:** `capacitaciones.escencialconsultora.com` (más adelante
se renombra a un dominio más general). Cada landing vive en su propio
`/{slug}`; el panel de administración está en `/admin`.

## Arquitectura

```
Visitante → GET /{slug} → busca la landing en Supabase, arma el HTML
            desde su plantilla + variables → responde

Visitante → POST /api/leads → valida, guarda el lead, agenda los
            envíos (email_sends) según los pasos configurados

Cron (cada 1h) / botón "Enviar pendientes ahora" en /admin
            → lib/email/process-pending.ts → Brevo → email al lead

Email → botón WhatsApp → GET /api/track → registra el click → redirige
            a wa.me (el LEAD manda el mensaje, no el sistema)

Facundo → /admin (login Supabase Auth) → crear/ver landings, leads,
            envíos con error
```

El schema completo (modelo de datos) está en
`supabase/migrations/0001_init.sql`, con comentarios explicando cada
tabla y por qué está armada así.

## Stack

- **Next.js 14 (App Router, TypeScript)** — Route Handlers para las
  rutas públicas, Server Actions para las mutaciones del panel.
- **Supabase (Postgres + Auth)** — base de datos real con constraints,
  reemplaza el hack de "dos bloques de columnas en una Sheet" del
  sistema viejo. Un solo usuario admin.
- **Netlify** — mismo sitio/dominio que ya estaba conectado. Scheduled
  Function para el envío horario de emails (reemplaza el trigger de
  Apps Script).
- **Brevo** — sin cambios, misma API que el sistema viejo.

## Estructura del repo

```
app/[slug]/route.ts          → landing pública, renderiza desde Supabase
app/api/leads/route.ts       → captura de leads (reemplaza doPost)
app/api/track/route.ts       → tracker de WhatsApp (reemplaza doGet)
app/admin/                   → panel de administración (protegido)
lib/supabase/                → clientes de Supabase (server + service role)
lib/email/process-pending.ts → lógica de envío, compartida por cron y botón manual
netlify/functions/           → Scheduled Function (cron horario)
supabase/migrations/         → schema SQL (0001_init) + datos de arranque (0002_seed)
archive/                     → sistema viejo (Sheets + Apps Script), solo referencia
docs/                        → docs del sistema viejo, con nota de que quedó reemplazado
```

## Setup local

1. `npm install`
2. Crear proyecto en [supabase.com](https://supabase.com).
3. **Conectar el proyecto a GitHub** (`Project Settings > Integrations >
   GitHub`, repo `EscencialConsult/capacitaciones.escencialconsultora.com`,
   rama `main`) — así `supabase/migrations/*.sql` se aplica solo en cada
   push, sin pegar nada a mano en el SQL Editor. Si todavía no la
   conectás, pegá `0001_init.sql` y después `0002_seed.sql` manualmente,
   en ese orden.
4. Crear el usuario admin en Supabase Auth (Authentication → Users →
   Add user).
5. Copiar `.env.local.example` a `.env.local` y completar con los
   valores de Settings → API de Supabase + la API key de Brevo.
6. `npm run dev` → `http://localhost:3000/admin/login`

## Deploy

Cargar las mismas variables de `.env.local.example` en Netlify (Site
configuration → Environment variables), confirmar que el build command
sea `next build`, y pushear a `main` — el deploy y la Scheduled Function
se activan solos.

## Decisiones clave (por qué está armado así)

- **Nombres de columna en inglés/ASCII**: el sistema viejo se rompió
  varias veces por un encabezado con "ñ" tipeado distinto al que
  esperaba el código. Con Postgres + TypeScript, ese error se detecta
  al guardar el archivo, no en producción.
- **Todo pasa por el servidor, nunca Supabase directo desde el
  navegador**: RLS habilitado sin policies públicas — el acceso real lo
  da la service role key, solo usada en Route Handlers/Server Actions.
- **`mensaje_whatsapp` lo manda el LEAD, no el sistema**: el botón de
  WhatsApp del email abre el WhatsApp del lead con un texto prellenado
  — el sistema nunca envía WhatsApps por su cuenta, solo registra la
  fecha del click.
- **Modelo de datos listo para escalar sin reescribir**: `landing_email_steps`
  no tiene límite de 4 pasos (era una limitación de columnas fijas en
  Sheets), y `brevo_accounts` ya modela la rotación multi-cuenta futura
  aunque hoy se use una sola.
