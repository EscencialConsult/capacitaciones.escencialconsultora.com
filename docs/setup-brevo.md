> **⚠️ Sistema descartado (2026-08-10).** Este doc describe el sistema viejo (Google Sheets + Apps Script), reemplazado por una plataforma en Next.js + Supabase. Se conserva como referencia histórica — ver el `README.md` de la raíz del repo para el sistema actual.

---

# Armar la cuenta de Brevo

Una sola cuenta para todo el proyecto/dominio — no una por landing (ver
sección 11 del plan original: reputación de envío, dominio verificado y
autenticación quedan atados a la cuenta, no conviene fragmentarlo).

## Pasos

1. Crear cuenta en https://www.brevo.com (plan gratuito: 300 emails/día).
2. **Verificar el dominio de envío** (`Settings > Senders, Domains & Dedicated IPs > Domains`):
   agregar los registros DNS (SPF, DKIM) que te da Brevo en el proveedor de tu dominio.
   Esto es lo que evita que los emails caigan en spam — no te saltees este paso.
3. Agregar el remitente (`Senders`): el email desde el que van a salir todos
   los envíos (ej. `info@tudominio.com`) y el nombre que ve el destinatario
   (ej. "Escencial Consultora"). Se configura acá, una sola vez — por eso
   `Config_Campañas` no tiene columna de remitente.
4. Generar una API key (`Settings > API Keys > Generate a new API key`).
   Copiala — la vas a necesitar para el paso siguiente.

## Cargar las credenciales

Decisión de Facundo: estas 3 van **hardcodeadas directo en `Code.gs`**, no
en Propiedades del script. Al principio del archivo hay 3 constantes
vacías a propósito:

```javascript
const BREVO_API_KEY = '';
const SENDER_EMAIL = '';
const SENDER_NAME = '';
```

Completalas **solo en la copia pegada dentro del editor de Apps Script**
— nunca en el archivo de este repo (el que se sube a GitHub se deja
siempre vacío). Si en algún momento actualizás `Code.gs` desde acá y lo
volvés a pegar entero en Apps Script, vas a tener que volver a completar
estas 3 líneas — son 10 segundos, pero no te olvides.

| Constante | Valor |
|---|---|
| `BREVO_API_KEY` | la API key generada en el paso 4 |
| `SENDER_EMAIL` | el email verificado en el paso 3 |
| `SENDER_NAME` | el nombre verificado en el paso 3 |

`WEBAPP_URL` y `DASHBOARD_SECRET` siguen yendo en Propiedades del script
(`⚙️ Configuración del proyecto > Propiedades del script`) — esas si no
tienen por qué vivir en el código.

## Probar que la API responde

Antes de conectar todo el flujo, probá un curl suelto para confirmar que
la cuenta y el dominio están bien configurados:

```bash
curl -X POST https://api.brevo.com/v3/smtp/email \
  -H "api-key: TU_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sender": {"name":"Escencial Consultora","email":"info@tudominio.com"},
    "to": [{"email":"tu-email-personal@gmail.com"}],
    "subject": "Prueba",
    "htmlContent": "<p>Si esto llega, la cuenta está lista.</p>"
  }'
```

Si devuelve `201` y el email llega (revisá spam la primera vez), la cuenta
está lista para conectar con Apps Script.