> **⚠️ Sistema descartado (2026-08-10).** Este doc describe el sistema viejo (Google Sheets + Apps Script), reemplazado por una plataforma en Next.js + Supabase. Se conserva como referencia histórica — ver el `README.md` de la raíz del repo para el sistema actual.

---

# Publicar el sitio en capacitaciones.escencialconsultora.com

Ojo con esto: hay **dos configuraciones de DNS distintas y separadas**,
para dos cosas que no tienen relación entre sí. Es fácil mezclarlas
porque las dos "tocan" el mismo dominio:

| DNS para... | Para qué sirve | Dónde se configura |
|---|---|---|
| **Hosting del sitio** | Que `capacitaciones.escencialconsultora.com` muestre la landing y el dashboard | Panel de DNS de tu dominio + panel de Netlify |
| **Verificación de Brevo** | Que puedas mandar emails "en nombre de" ese dominio sin caer en spam | Panel de DNS de tu dominio + panel de Brevo |

Son registros DNS distintos que conviven sin problema en el mismo dominio —
no hace falta elegir uno u otro, se hacen los dos.

## 1. Hosting: Netlify

No hace falta cargar ninguna variable de entorno en Netlify para este
proyecto: es HTML/JS puro, sin build ni funciones de servidor, así que no
hay ningún paso de compilación donde una env var pudiera "inyectarse" en
el código. El único valor que necesita el frontend (`WEBAPP_URL`) va
escrito directo en `index.html` y `dashboard/index.html` — y no
es secreto: es la URL pública del Web App, visible igual en la pestaña de
Red del navegador apenas la landing hace el POST. Lo que sí es secreto
(API key de Brevo, remitente, clave del dashboard) vive únicamente en las
Propiedades del script de Apps Script — nunca toca Netlify ni este repo.

1. En [app.netlify.com](https://app.netlify.com) → **Add new site > Import
   an existing project > GitHub** → elegís
   `EscencialConsult/capacitaciones.escencialconsultora.com`.
2. **Build command**: dejalo vacío. **Publish directory**: `.` (raíz del
   repo) — no hay nada que compilar.
3. Deploy. Te da una URL de prueba tipo `nombre-random.netlify.app`.
4. `Site configuration > Domain management > Add a domain` → cargás
   `capacitaciones.escencialconsultora.com`. Netlify te muestra el
   registro DNS exacto a crear (para un subdominio, normalmente un
   `CNAME` apuntando a `[tu-sitio].netlify.app`).
5. Vas al panel de DNS donde administrás `escencialconsultora.com` y
   cargás ese registro.
6. Esperás la propagación (minutos a un par de horas) — Netlify emite el
   certificado SSL solo, no hay que hacer nada más.

**Con esto, `/dashboard` funciona solo**: como es una carpeta con
`index.html` adentro (`dashboard/index.html`), Netlify la sirve directo en
`capacitaciones.escencialconsultora.com/dashboard` sin configuración extra.

**Deploy automático**: una vez conectado, cada `git push` a `main` dispara
un deploy nuevo solo — no hace falta subir nada a mano desde Netlify.

## 2. Brevo: verificar el dominio para el remitente

Esto es independiente del hosting — es para que el email que mandás
(ej. `info@capacitaciones.escencialconsultora.com`) no caiga en spam.

1. En Brevo: `Senders, Domains & Dedicated IPs > Domains > Add a domain`.
2. Cargás `capacitaciones.escencialconsultora.com` (o `escencialconsultora.com`
   si preferís que el remitente use el dominio raíz).
3. Brevo te da 2-3 registros (normalmente `TXT` para SPF y `CNAME`/`TXT`
   para DKIM) — se agregan en el mismo panel de DNS del dominio, junto al
   registro del paso 1 (no se pisan entre sí).
4. Volvés a Brevo y tocás "Verificar" — puede tardar un rato en propagar.
5. Una vez verificado, agregás el remitente real en `Senders` (ej. nombre
   "Escencial Consultora", email `info@capacitaciones.escencialconsultora.com`)
   con el logo que quieras que vean los destinatarios.
6. Esos dos valores (nombre y email) son los que van en `SENDER_NAME` y
   `SENDER_EMAIL` de las Propiedades del script — reemplazando el email
   personal que usaste para las pruebas iniciales.

## Orden recomendado

No hace falta esperar a que las dos verificaciones terminen para seguir
probando — podés dejar las dos DNS cargadas y mientras propagan, seguir
probando el flujo con el sender de prueba (tu email personal) que ya
tenés configurado. Cuando el dominio de Brevo quede verificado, solo
actualizás `SENDER_EMAIL`/`SENDER_NAME` en las Propiedades del script —
nada más se toca.