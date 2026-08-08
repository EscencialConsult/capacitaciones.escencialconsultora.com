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

## Cargar las credenciales en Apps Script

Una vez que el proyecto de Apps Script esté creado (ver checklist-implementacion.md):

`Extensiones > Apps Script > ⚙️ Configuración del proyecto > Propiedades del script > Agregar propiedad del script`

Cargar estas 3 (más `WEBAPP_URL` que se agrega después del primer deploy):

| Propiedad | Valor |
|---|---|
| `BREVO_API_KEY` | la API key generada en el paso 4 |
| `SENDER_EMAIL` | el email verificado en el paso 3 |
| `SENDER_NAME` | el nombre verificado en el paso 3 |

Nunca van hardcodeadas en el código — así el `.gs` se puede compartir o
subir a un repo sin exponer nada.

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
