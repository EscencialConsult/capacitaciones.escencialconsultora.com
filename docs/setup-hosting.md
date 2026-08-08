# Publicar el sitio en capacitaciones.escencialconsultora.com

Ojo con esto: hay **dos configuraciones de DNS distintas y separadas**,
para dos cosas que no tienen relación entre sí. Es fácil mezclarlas
porque las dos "tocan" el mismo dominio:

| DNS para... | Para qué sirve | Dónde se configura |
|---|---|---|
| **Hosting del sitio** | Que `capacitaciones.escencialconsultora.com` muestre la landing y el dashboard | Panel de DNS de tu dominio + panel de Vercel |
| **Verificación de Brevo** | Que puedas mandar emails "en nombre de" ese dominio sin cSaer en spam | Panel de DNS de tu dominio + panel de Brevo |

Son registros DNS distintos que conviven sin problema en el mismo dominio —
no hace falta elegir uno u otro, se hacen los dos.

## 1. Hosting: Vercel (recomendado, ya es parte de tu stack)

1. En [vercel.com](https://vercel.com), **Add New > Project** → importás el
   repo `EscencialConsult/capacitaciones.escencialconsultora.com` (ya está
   pusheado a GitHub).
2. Como es un sitio estático (sin build), Vercel lo detecta solo — no hace
   falta configurar ningún comando de build.
3. Deploy. Te da una URL tipo `capacitaciones-escencialconsultora-com.vercel.app`
   para probar antes de conectar el dominio propio.
4. `Project Settings > Domains` → agregás `capacitaciones.escencialconsultora.com`.
   Vercel te muestra el registro DNS exacto a crear (normalmente un `CNAME`
   apuntando a `cname.vercel-dns.com`, porque es un subdominio, no el
   dominio raíz).
5. Vas al panel de DNS donde administrás `escencialconsultora.com` y
   cargás ese registro.
6. Esperás la propagación (minutos a un par de horas) — Vercel emite el
   certificado SSL solo, no hay que hacer nada más.

**Con esto, `/dashboard` funciona solo**: como es una carpeta con
`index.html` adentro (`dashboard/index.html`), Vercel la sirve directo en
`capacitaciones.escencialconsultora.com/dashboard` sin configuración extra.

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
