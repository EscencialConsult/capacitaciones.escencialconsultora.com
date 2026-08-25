# Plan — Rediseño del panel admin (armado 2026-08-24, para ejecutar 24-25/08)

Pedido de Facundo: mejorar el diseño de **todas las interfaces del panel admin** (no las landings
públicas, esas ya tienen su propio sistema de diseño elaborado vía `SISTEMA_DISENO_LANDING`). Hoy
están con un diseño simple/genérico. Objetivo: mejora de +100%, mucho más elaborado, coherente entre
todas las pantallas, sin sacrificar performance de carga. Se activaron 3 skills: `anti-ia`, `peluche`,
`react-doctor` — sus checklists y criterios están volcados acá abajo para no tener que releerlas.

**No arrancar de cero mañana** — leer este archivo primero, ya hay diagnóstico + fundación hechos.

---

## 0. Ya hecho esta sesión (verificado con `tsc --noEmit`, no rompe nada porque todavía nada lo usa)

- **`tailwind.config.ts`**: sistema de sombras `shadow-one-sm/md/lg` (tres escalones, teñidas de
  `one-oscuro`, nunca gris/negro puro) + `shadow-one-fucsia` (sombra de marca, reservada para EL
  elemento más importante de una pantalla, nunca un grid entero) + `bg-one-dots` (textura de puntos
  sutil para el fondo del shell).
- **`app/globals.css`**: agregado al final del archivo —
  - `.admin-glow` — dos manchas de color (fucsia arriba-derecha, cian abajo-izquierda) `fixed`,
    blur 120px, opacidad bajísima. Para poner en el layout del shell, no por página.
  - `.stagger-in` — entrada escalonada de listas/grids vía `--stagger-index` inline por ítem.
  - `.table-row-hover` — barra de acento fucsia a la izquierda en hover de fila, sin sombra/glow.
  - `.skeleton-shimmer` — shimmer del loading real (barrido con `transform`, no `background-position`,
    a propósito: transform corre en compositor GPU, no dispara repaint — clave para que el PRIMER
    load ya se sienta rápido, no solo los siguientes).
  - Todo respeta `prefers-reduced-motion`.

## 1. Referencia de estilo ya validada: `app/admin/login/page.tsx`

Esta pantalla YA está en el nivel que se busca para el resto — usarla como norte, no reinventar:
gradiente de texto (`bg-gradient-to-r from-one-fucsia to-one-cian bg-clip-text text-transparent`),
badge tipo pill con `one-cian`, bullets de color por feature, capas de opacidad sobre `one-oscuro`
para profundidad. El resto del panel (CRUD screens) está muy por debajo de esto — nivelar hacia arriba.

## 2. Paleta — usar lo que YA existe en `tailwind.config.ts`, nunca inventar color nuevo

`one-negro`, `one-oscuro`, `one-blanco`, `one-fucsia` (primario/CTA/activo — ya se usa en todos
lados), `one-cian` (secundario — HOY casi no se usa fuera del login, usarlo mucho más: badges info,
acentos secundarios, enlaces destacados), `one-dorado` (terciario — para "destacado", números/stats,
nunca como color de error), `one-lavanda`, `one-gris-claro`, `one-rojo` (error/destructivo, ya
establecido), `emerald-*` (éxito/activo, ya establecido en badges de estado, mantenerlo).

## 3. Checklist `anti-ia` (aplicar como filtro de calidad, no como receta de "menos color")

El pedido es MÁS elaborado, no menos — pero elaborado ≠ genérico-IA. Al aplicar más color/detalle,
evitar activamente:
- Gradient border en tarjetas en estado IDLE (gradiente ok en texto de títulos, hover, o el
  elemento realmente destacado — no en todo un grid).
- Glow/ambient radial DENTRO de cada tarjeta de un listado.
- 3+ badges de color distinto en una misma fila/tarjeta — un solo badge con color real (el dato
  más importante), el resto neutro (`bg-one-oscuro/5 text-one-oscuro/60`).
- Sombra fuerte en estado idle — usar `shadow-one-sm` en reposo, `shadow-one-md` recién en hover.
- Opacidades sueltas sin sistema — usar la escala ya establecida (`/5`, `/10`, `/15`, `/40`, `/60`).
- Botón sólido de color en TODO lado — reservar sólido para la acción primaria de la pantalla,
  el resto outline/ghost que toma color en hover (patrón ya usado en `page.tsx` home:
  "+ Nueva campaña" sólido vs "+ Nueva plantilla" outline — ese contraste es correcto, replicarlo).

**Regla de oro (repetirla al ejecutar cada pantalla):** el tratamiento especial se reserva para lo
que lo amerita — recomendado, seleccionado, CTA principal, alerta real. El resto: clean pero con
más cuidado de detalle (spacing, tipografía, hover states) que hoy.

## 4. `react-doctor` — baseline y qué hacer con cada hallazgo

Corrido `npx react-doctor@latest --verbose` (ver salida completa guardada en la conversación /
`C:\Users\PERSONAL\AppData\Local\Temp\claude\...\tasks\bdxs41kgc.output` si todavía existe).
**Score: 41/100 (Critical)**, 66 issues.

### Arreglar YA, junto con el rediseño (mecánico, seguro, cero riesgo de regresión):
- **`no-transition-all` × 30 archivos** — todo el proyecto usa `transition-all duration-300`.
  Cambiar a transiciones explícitas (`transition-[transform,box-shadow]`, `transition-colors`,
  etc. según lo que realmente anima cada elemento) en cada archivo que se toque de todos modos.
  Lista completa de archivos afectados está en el output de react-doctor.
- **`label-has-associated-control`** en `AvatarPicker.tsx:24` — el `<label>` "Ícono de perfil" no
  tiene control asociado (es un widget custom, no un input único). Fix: `htmlFor` apuntando al
  input hidden, o cambiar a `<span id="...">` + `aria-labelledby` en el contenedor del picker.
- **`no-placeholder-only-field` × 3** — `DashboardHeader.tsx` (buscador), `NewEmailTemplateModal.tsx`,
  `NewCategoryModal.tsx`. Agregar label visualmente oculto (`sr-only`) o `aria-label`.
- **`no-autofocus` × 3** en los 3 modales (`NewEmailTemplateModal`, `NewLandingModal`,
  `NewCategoryModal`) — evaluar caso por caso: autofocus al abrir un modal de creación suele ser
  UX intencional válida, no sacarlo a ciegas. Si se mantiene, dejarlo documentado como decisión,
  no como pendiente.

### Investigar antes de decidir (no mecánico, puede ser falso positivo o necesitar más contexto):
- **`useSearchParams without Suspense` × 2** (`campaigns/[id]/edit/page.tsx:53`,
  `campaigns/new/page.tsx:28`) — riesgo real de build en Next 14 si falta `<Suspense>` envolviendo
  el componente que usa `useSearchParams`. Verificar si ya está envuelto en algún punto más arriba
  del árbol antes de tocar nada.
- **`no-derived-useState` × 3` / `no-pass-data-to-parent` × 3` / `no-adjust-state-on-prop-change` × 3**
  (`CampaignForm.tsx`, los 3 modales, `IntegrationCard.tsx`) — son hallazgos de ARQUITECTURA de
  React, no de diseño visual. Alto riesgo de regresión si se tocan sin entender bien el porqué de
  cada patrón actual (mucho de este código ya pasó por 5 rondas de fixes de bugs esta sesión).
  **No tocar en la misma pasada que el rediseño visual** — si se quiere resolver, hacerlo aparte,
  con su propio diagnóstico, después de que el rediseño visual esté verificado y estable.
- **`no-giant-component`** en `CampaignForm.tsx:226` — es real (el wizard de 4 pasos es grande).
  Partirlo en sub-componentes es una mejora válida pero de arquitectura, no de diseño — considerar
  para una sesión aparte, no mezclar con el rediseño visual.
- **`no-locale-format-in-render`** y **`rendering-hydration-mismatch-time`** (`IntegrationCard.tsx:114`,
  `users/page.tsx:40`) — formateo de fecha (`toLocaleDateString`) durante el render puede causar
  mismatch de hidratación server/cliente. Revisar si ya causa algún warning en consola del navegador
  antes de decidir el fix (mover a un `useEffect` + estado, o formatear en el servidor y pasar como
  string ya listo).
- **`Side effect in GET handler`** (único ERROR, no warning) en `app/api/track/route.ts:21` — el
  endpoint de tracking de clicks a WhatsApp escribe en la base dentro de un GET. Es un patrón común
  y casi inevitable para links de tracking (un link de email siempre es GET, no se puede forzar POST
  desde un cliente de correo) — YA está mitigado con un guard (`if (!lead.whatsapp_clicked_at)`, solo
  el primer click cuenta). Es una decisión de producto/arquitectura, no un bug de diseño — **reportarlo
  a Facundo, no tocarlo sin que él decida** (la alternativa real, una interstitial con confirmación
  antes de redirigir, agrega fricción al flujo de WhatsApp que probablemente no quiere).

### Ignorar (falsos positivos / fuera de alcance, confirmado):
- Todo lo de `.netlify/**` (postMessage sin origin check, BaaS authority map, weak crypto) — son
  artefactos de build minificados/generados (bundles de webpack, polyfills de terceros), se
  regeneran en cada build, no son código fuente editable.
- Todo lo de `archive/**` — sistema viejo (Sheets + Apps Script) explícitamente conservado como
  registro histórico, no se toca (nunca se usa en producción).
- `no-vulnerable-react-server-components` sobre `package.json` — Next está en `^14.2.35`. Antes de
  actuar, correr `npm outdated next` y decidir si vale la pena actualizar — es un cambio de
  dependencia, no de diseño, evaluarlo aparte con su propio testeo de regresión.

**Verificación al terminar:** volver a correr `npx react-doctor@latest --verbose` y confirmar que
el score subió y que los 30 `no-transition-all` + los 4 de accesibilidad ya no aparecen.

## 5. Alcance — inventario completo (47 archivos) agrupado para ejecutar

**Fundación (primero, todo lo demás depende de esto para la consistencia):**
`FormInput.tsx`, `DeleteButton.tsx`, `Avatar.tsx`, `AvatarPicker.tsx`, `DashboardSidebar.tsx`,
`DashboardHeader.tsx`, `layout.tsx` (agregar `.admin-glow` + `bg-one-dots` al shell),
`loading.tsx` (usar `.skeleton-shimmer`), `error.tsx`, `page.tsx` (home — tarjetas de stats con
íconos + elevación, tabla de últimos leads con `.table-row-hover`).

**Grupo Campañas** (el más grande y complejo — wizard de 4 pasos):
`ActivateButton.tsx`, `CampaignStatusButton.tsx`, `CopyLandingPromptButton.tsx`,
`NewEmailTemplateModal.tsx`, `NewLandingModal.tsx`, `CampaignForm.tsx`, `campaigns/page.tsx`,
`campaigns/new/page.tsx`, `campaigns/[id]/edit/page.tsx`, `campaigns/[id]/leads/page.tsx`.

**Grupo Landings:**
`LandingForm.tsx`, `LandingToggleActivaButton.tsx`, `EnviarPendientesButton.tsx`,
`landings/page.tsx`, `landings/new/page.tsx`, `landings/[id]/edit/page.tsx`.

**Grupo Plantillas (landing + email):**
`TemplateForm.tsx`, `templates/ToggleActivaButton.tsx`, `CopyPromptButton.tsx`,
`NewCategoryModal.tsx`, `templates/page.tsx`, `templates/new/page.tsx`,
`templates/[id]/edit/page.tsx`, `EmailTemplateForm.tsx`, `email-templates/ToggleActivaButton.tsx`,
`email-templates/page.tsx`, `email-templates/new/page.tsx`, `email-templates/[id]/edit/page.tsx`.

**Grupo Usuarios + Perfil + Integraciones:**
`CreateUserForm.tsx`, `UserActions.tsx`, `users/page.tsx`, `ProfileAvatarForm.tsx`,
`profile/page.tsx`, `IntegrationCard.tsx`, `settings/integrations/page.tsx`.

**Login** (ya está bien — solo revisar consistencia con lo nuevo, cambios mínimos):
`AuthInput.tsx`, `login/page.tsx`.

## 6. Cómo ejecutar mañana (recomendado)

1. Releer este archivo + los 3 SKILL.md (`anti-ia`, `peluche`, `react-doctor` — invocar de nuevo
   con el `Skill` tool para tenerlos frescos en contexto, no asumir que se recuerdan).
2. Terminar la Fundación (sección 5) — a mano, con cuidado, porque todo lo demás la referencia.
3. Los 5 grupos restantes se pueden paralelizar con subagentes (`Agent` tool, sin necesidad de
   `Workflow`/ultracode salvo que Facundo lo pida explícitamente) — cada uno recibe: este plan
   completo, la sección 2-4 como spec obligatoria, y la instrucción explícita de leer primero los
   archivos de Fundación ya actualizados como referencia de patrón. Grupos = archivos disjuntos,
   se pueden correr en simultáneo sin pisarse.
4. Regla dura de toda la sesión: **cambios visuales/estructurales de CSS y clases, nunca tocar
   lógica de negocio, validaciones, Server Actions, ni ningún comentario que documente un bug real
   ya corregido** — todo eso costó 5 rondas de loop-exhaustivo, no arriesgarlo en una pasada de diseño.
5. Verificación final: `npx tsc --noEmit`, `npm run build`, `npx react-doctor@latest --verbose`
   (comparar score contra el 41/100 de hoy), y si hay forma de levantar el dev server y mirarlo en
   navegador, hacerlo antes de dar por terminado (Playwright si está disponible esa sesión).
6. **Git**: NO commitear/pushear a `main` directo (ver regla del propio `CLAUDE.md` de la sesión:
   "si está en la rama default, ramificar primero"). Crear una rama nueva (ej.
   `rediseno-admin-panel`), commitear ahí, pushear esa rama a `origin`
   (`github.com/EscencialConsult/capacitaciones.escencialconsultora.com`) — no mergear a `main`
   sin que Facundo lo pida explícitamente.

## 7. Lo que NO es parte de este pedido (no expandir el alcance solo)

- Las landings públicas (`app/[slug]/route.ts`, `lib/landing-template-defaults.ts`) — ya tienen su
  propio sistema de diseño elaborado, no tocar.
- El endpoint de `/api/track` (side effect en GET) — reportar, no arreglar sin decisión de Facundo.
- Arquitectura de React (giant component, derived state) — aparte, no en esta pasada.
- Actualizar la versión de Next.js — aparte, con su propio testeo.
