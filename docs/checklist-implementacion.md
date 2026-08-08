# Checklist de implementación

Lo que ya está armado en este repo local vs. lo que tenés que hacer vos a
mano (Google Sheets, Apps Script editor, GitHub, Brevo son todas cuentas
tuyas — no puedo tocarlas desde acá).

## Ya armado en `PROYECTOS LANDINGS/`

- [x] Repo conectado y pusheado a `github.com/EscencialConsult/capacitaciones.escencialconsultora.com`
- [x] `landing/index.html` — landing de prueba con formulario
- [x] `dashboard/index.html` — panel de estado, pensado para publicarse en `/dashboard`
- [x] `apps-script/Code.gs` — Script A (Receptor) + Script B (Enviador + Brevo) + Script C (Tracker) + endpoint del Dashboard, todo en un solo archivo
- [x] `templates-email/design-base-1/email.html` — diseño base reutilizable
- [x] `docs/setup-sheets.md` — una sola pestaña `Datos`, con las columnas exactas de los bloques Leads y Config_Campañas
- [x] `docs/setup-brevo.md` — pasos de cuenta, dominio y API key
- [x] `docs/setup-hosting.md` — publicar en Netlify + conectar el dominio + verificar Brevo (dos DNS separados)

## Paso a paso para dejarlo andando

1. **Armar la planilla de Sheets** → seguir `docs/setup-sheets.md`
   (una sola pestaña llamada `Datos`, con Leads en columnas A:Q y
   Config_Campañas en columnas S:AM). Guardá el ID de la planilla
   (está en la URL, entre `/d/` y `/edit`).

2. **Crear el proyecto de Apps Script** desde la propia planilla:
   `Extensiones > Apps Script`. Esto lo ata automáticamente a la planilla
   (`SpreadsheetApp.getActiveSpreadsheet()` en el código ya apunta a la
   correcta, sin necesidad de pegar el ID en ningún lado).

3. **Pegar el código**: copiá el contenido completo de `apps-script/Code.gs`
   en el archivo `Code.gs` que Apps Script crea por default (o pegalo ahí
   directamente, no hace falta crear archivos nuevos — es uno solo).
   Reemplazá el `appsscript.json` (activá "Mostrar archivo de manifiesto"
   en ⚙️ Configuración del proyecto) por el de `apps-script/appsscript.json`.

   > Alternativa más cómoda a futuro: la skill `gs-sync` (clasp) sincroniza
   > este archivo automáticamente cada vez que lo edites acá, sin copiar/pegar.
   > Se puede sumar en cualquier momento, no es bloqueante para arrancar hoy.

4. **Cargar las credenciales de Brevo** → seguir `docs/setup-brevo.md`
   (Propiedades del script: `BREVO_API_KEY`, `SENDER_EMAIL`, `SENDER_NAME`).
   Para arrancar podés usar tu email personal como remitente de prueba —
   el dominio propio se conecta después, sin tocar código (ver paso 11).

5. **Deployar el Web App**: `Implementar > Nueva implementación > Aplicación web`.
   - Ejecutar como: **Yo** (tu cuenta)
   - Quién tiene acceso: **Cualquier usuario**
   - Copiá la URL que te da (`.../exec`).

6. **Cargar `WEBAPP_URL`** como Propiedad del script con esa URL recién copiada
   (necesaria para armar los links de tracking de WhatsApp y para que
   `landing/index.html` y `dashboard/index.html` sepan a dónde pegarle).

7. **Cargar también `DASHBOARD_SECRET`** como Propiedad del script — inventate
   cualquier texto largo y random (ej. generado en un gestor de contraseñas).
   Es la clave que vas a tipear en `/dashboard` para ver el estado de las
   campañas — no la escribas en ningún archivo del repo.

8. **Pegar `WEBAPP_URL`** en dos lugares:
   - `landing/index.html`, línea `WEBAPP_URL`
   - `dashboard/index.html`, línea `WEBAPP_URL`

9. **Template del email**: por ahora podés probar sirviendo
   `templates-email/design-base-1/email.html` desde un GitHub Gist (URL
   pública rápida). Cuando quieras la versión definitiva, va directo al
   repo ya conectado — mismo nombre de archivo para siempre (sección 5 del
   plan original). Pegá la URL final en la celda `template_base_1` de
   `Config_Campañas`.

10. **Crear el trigger horario**: en el editor de Apps Script, seleccioná
    la función `crearTriggerHorario` (arriba a la izquierda, al lado de
    "Ejecutar") y tocá "Ejecutar". Se crea una vez y queda corriendo solo
    cada 1 hora. Para probar rápido sin esperar una hora, seleccioná
    `enviarPendientes` y ejecutala manualmente desde el editor.

11. **Publicar el sitio y conectar el dominio** → seguir `docs/setup-hosting.md`
    (Netlify + DNS del hosting + DNS de verificación de Brevo — son dos
    cosas separadas, no te saltees la aclaración del doc).

12. **Probar el flujo completo**:
    - Abrí la landing publicada (o `landing/index.html` local para probar rápido).
    - Completá el formulario → verificá que aparece la fila en el bloque
      Leads (columnas A:Q) de la pestaña `Datos`.
    - Corré `enviarPendientes` manualmente → verificá `estado_1 = enviado`
      y que el email llegó.
    - Cliqueá el botón de WhatsApp del email → verificá que
      `contacto_confirmado_fecha` se completó y que redirigió a WhatsApp.
    - Entrá a `/dashboard`, tipeá la clave → verificá que se ve la campaña
      de prueba con sus contadores actualizados.

## Reglas para no romper nada más adelante

- **Actualizar un template**: mismo nombre de archivo en GitHub, se
  sobreescribe con `git push`. No se toca Sheets ni Apps Script.
- **Repetir una campaña igual**: no se toca nada, se vuelve a mandar
  tráfico a la misma landing con el mismo `origen_campaña`.
- **Campaña nueva o landing nueva**: fila nueva en el bloque Config_Campañas
  (columnas S:AM) con `origen_campaña` distinto (ej. `..._sep26`). No se
  borra la fila vieja hasta que no quede ningún lead con `estado_N =
  pendiente` de esa campaña.
- **Nunca escribas manualmente en las columnas A:Q** (bloque Leads) salvo
  para corregir un dato puntual — esas columnas las mantiene el código. Sí
  podés escribir libremente en S:AM (bloque Config_Campañas), es tuyo.
- **Límite de 6 minutos por ejecución** de los triggers: si el bloque Leads
  crece mucho, `enviarPendientes` va a necesitar paginar (procesar de a
  bloques) — no es necesario todavía con poco volumen.
