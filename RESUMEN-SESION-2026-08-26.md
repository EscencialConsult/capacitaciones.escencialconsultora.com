# Resumen — sesión 2026-08-26

Todo lo hecho hoy sobre el panel admin, en orden. El detalle completo de cada cambio (qué se rompió,
por qué, cómo se probó) está en los mensajes de commit de `git log` — esto es el resumen para no
tener que releer todo.

---

## 1. Rediseño visual — íconos, tablas, layout

- Todos los botones de texto ("Editar", "Activar", "Eliminar"...) de las 7 tablas del panel pasaron
  a íconos Lucide (`IconAction.tsx`, componente compartido).
- Bug real: pasar un ícono como prop de Server a Client Component rompía `/admin/campaigns` (RSC no
  deja pasar funciones crudas por ese borde) — arreglado pasándolo como `children` ya renderizado.
- Bug real: `.table-row-hover` usaba `position: relative` en el `<tr>`, rompía el layout de columnas
  en TODAS las tablas — reemplazado por `box-shadow: inset`.
- Componente genérico `AdminTable.tsx` (`TableShell`/`TableHead`/`TableEmptyRow`) para que las 7
  tablas compartan una sola fuente de verdad del encabezado (gris + borde inferior fucsia).
- Panel sin `max-w-6xl`: usa el ancho real de la pantalla en vez de quedar centrado con espacio
  vacío a los costados.
- Logo real de marca (isotipo, no texto) en la columna "Marca" de Plantillas de landing.
- Paso 5 "Publicación" en el form de campañas — Activar + Visualizar landing + verificación en vivo
  del link, en el mismo lugar donde ya vivía Guardar.
- Badge de estado "Activa" ahora confirma con un fetch real al link antes de decirlo (antes confiaba
  ciegamente en el status de la base).

## 2. Seguridad — puerta de entrada del panel

- `/admin` y `/admin/login` pisados directo (sin sesión) devuelven 404 — no hay rastro público de
  que el panel existe. Se entra por `/<ADMIN_SECRET_PATH>/login` (valor en `.env.local` y en Netlify),
  que `middleware.ts` reescribe por dentro sin que la URL cambie.
- El login vive también en la raíz del dominio (`/`), no solo en `/admin/login`.

## 3. Sistema de créditos por persona

- Cada admin conecta sus **propias** cuentas de Brevo/Resend desde Integraciones (antes era una
  pantalla global compartida) — `brevo_accounts`/`resend_accounts` ganaron `user_id`.
- `campaigns.activated_by` registra quién activó cada campaña — desde el 26/8 en adelante, las de
  antes quedan sin dueño a propósito (no se reconstruye el pasado).
- Créditos mensuales = suma del free tier de las cuentas conectadas (Brevo 300/día×30, Resend
  3000/mes) + lo que se declare si se marca una cuenta como "plan pago" (stub real, sin pasarela de
  pago todavía).
- Ciclo mensual anclado al día 25. Reserva **completa** al registrarse un lead (no por cada email
  que sale), atómica (`pg_advisory_xact_lock`) — si no alcanza el crédito, la campaña se pausa sola
  y ese registro puntual se rechaza.
- Medidores en Mi Perfil: en vivo (ya reservado) + proyectado (estimación a fin de ciclo) + detalle
  de campañas propias.

## 4. Bug real de fondo: los emails no salían

Tres causas distintas, todas encontradas y arregladas:

1. **Límite de 30s de Netlify** — las funciones programadas (`schedule`) se cortan a los 30 segundos
   sin excepción. Con varios emails pendientes en el mismo ciclo, se cortaba a mitad de camino.
   Arreglado con el patrón oficial de Netlify: la función programada (`send-pending-emails.ts`) solo
   dispara una función "background" (`process-pending-emails-background.ts`, hasta 15 min) que hace
   el trabajo real.
2. **La causa raíz real** — `email_sends.brevo_account_id` tenía una foreign key a `brevo_accounts`.
   Al mandar por Resend, el UPDATE final que marca "enviado" guardaba ahí un id de `resend_accounts`
   y Postgres lo rechazaba (23503) — como el código no revisaba ese error puntual, el email salía de
   verdad pero la fila quedaba en `processing` para siempre, sin rastro. Arreglado con una columna
   propia (`resend_account_id`) y chequeo real del error del UPDATE.
3. **Horas mostradas en UTC** — todo el panel mostraba fechas 3hs adelantadas de la hora real de
   Argentina (`toLocaleString('es-AR')` sin `timeZone`). Centralizado en `lib/fecha.ts`.

Botón para reintentar un envío puntual que quedó en error, en la pantalla de leads de cada campaña.

## 5. Brevo/Resend — orden de envío y deliverability

- Orden confirmado: **Brevo primero, Resend de respaldo** (lugar dejado para Google a futuro, sin
  implementar). El error 401 de Brevo por "IP no autorizada" — confirmado en vivo desde el servidor
  real de Netlify que ya no bloquea.
- Documentado en las instrucciones del panel (Integraciones → Brevo) el paso de desactivar "IPs
  autorizadas" en Brevo — no se puede resolver con código, es una config de seguridad de la cuenta
  de Brevo, solo se toca desde su dashboard.
- Los primeros envíos de prueba por Resend (`onelabs.pro`, dominio recién verificado) cayeron en
  spam — esperable en un dominio sin historial, no es un bug.

## 6. `SECRETS_ENCRYPTION_KEY` faltaba en Netlify producción

Quedó pendiente desde el principio de la sesión (mencionado en resúmenes anteriores) y nunca se
confirmó cargado — sin esa variable, el servidor no podía desencriptar NINGUNA clave guardada desde
Integraciones. Cargado directo en Netlify vía su CLI (ya logueado en esta máquina) y redeployado.

---

## Pendiente / a tu criterio

- La carpeta `ejemplo/` sigue sin subir al repo — decisión tuya si se sube o se deja afuera.
- Campañas activadas antes del 26/8 no tienen dueño para el sistema de créditos (a propósito) — si
  querés que empiecen a contar, hay que reactivarlas.
- Google como tercer proveedor de envío: solo mencionado, sin implementar.
