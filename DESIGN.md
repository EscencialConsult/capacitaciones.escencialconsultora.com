---
name: Escencial — Panel de Administración
description: Panel interno para armar campañas de landings + email, revisar leads y administrar el sistema, premium pero ágil.
colors:
  negro: "#000000"
  oscuro: "#1a181d"
  blanco: "#fefeff"
  fucsia: "#e17bd7"
  cian: "#6be1e3"
  dorado: "#e4c76a"
  lavanda: "#a4a8c0"
  gris-claro: "#c6c9d7"
  rojo: "#e2445c"
  exito: "#059669"
typography:
  display:
    fontFamily: "Exo 2, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Exo 2, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 800
    lineHeight: 1.3
    letterSpacing: "normal"
  title:
    fontFamily: "Exo 2, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "normal"
  body:
    fontFamily: "Exo 2, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Exo 2, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.02em"
rounded:
  sm: "8px"
  md: "16px"
  lg: "24px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.fucsia}"
    textColor: "{colors.negro}"
    rounded: "{rounded.full}"
    padding: "10px 24px"
  button-primary-hover:
    backgroundColor: "{colors.fucsia}"
    textColor: "{colors.negro}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.oscuro}"
    rounded: "{rounded.full}"
    padding: "10px 24px"
  card:
    backgroundColor: "{colors.blanco}"
    rounded: "{rounded.lg}"
    padding: "20px"
  input:
    backgroundColor: "{colors.blanco}"
    textColor: "{colors.oscuro}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
---

# Design System: Escencial — Panel de Administración

## 1. Overview

**Creative North Star: "El Panel de Control de Precisión"**

Como la cabina de un instrumento de precisión: cada dato en su lugar exacto, cero ruido visual
entre el admin y la tarea que vino a resolver, pero con un acento de color vivo que le da calidez
a lo técnico — nunca una herramienta fría de SaaS genérico. La superficie es clara y casi plana en
reposo (fondo `one-blanco`, tarjetas `one-oscuro/5`); la profundidad aparece solo cuando algo
responde a una acción del usuario, nunca como decoración estática. El acento `one-fucsia` es el
único color que grita — todo lo demás (`one-cian`, `one-dorado`) susurra en su rol secundario.

Este sistema rechaza explícitamente lo genérico-IA: gradientes aplicados por todos lados en vez de
solo donde suman, glow ambient dentro de cada tarjeta de una lista, badges de 3+ colores distintos
en una misma fila, cards idénticas en grilla sin ninguna jerarquía real entre ellas, sombras
fuertes en estado de reposo, opacidades sueltas sin sistema.

**Key Characteristics:**
- Superficie clara y casi plana en reposo; la sombra aparece como respuesta, no como default.
- Un único acento saturado (`one-fucsia`) para la acción primaria de cada pantalla — el resto,
  outline o neutro.
- `one-cian` y `one-dorado` como voces secundarias reales, no decorativas — hoy infrautilizados
  fuera del login, deberían aparecer mucho más en el resto del panel.
- Tipografía Exo 2 en toda la interfaz, jerarquía por peso y tamaño, nunca por color.
- Radios generosos (`8/16/24px`) y botones tipo píldora (`rounded-full`) — nunca esquinas duras.

## 2. Colors

Paleta de marca ONE/Escencial, ya fija en `tailwind.config.ts` — nunca inventar un color fuera de
esta lista.

### Primary
- **Fucsia Escencial** (`#e17bd7`): el único color que se usa para gritar — CTA primario de cada
  pantalla, ítem de navegación activo, foco de inputs. Su rareza es el punto: si aparece en más de
  un lugar por pantalla, algo está mal.

### Secondary
- **Cian Estudio** (`#6be1e3`): acento secundario — badges tipo pill informativos ("Panel de
  administración" en el login), bullets de feature, segundo color en gradientes de texto puntuales.
- **Dorado Instrumento** (`#e4c76a`): acento terciario — números/stats destacados, indicadores
  "esto es importante pero no es un error", nunca para estados de éxito (ese rol es del verde) ni
  de alerta (ese rol es del rojo).

### Neutral
- **Negro Absoluto** (`#000000`): texto sobre fondo `fucsia` (nunca blanco sobre fucsia — falla
  contraste), y como base de `one-oscuro`.
- **Oscuro Escencial** (`#1a181d`): texto principal sobre fondo claro, fondo del shell del login y
  el sidebar, base de casi todas las opacidades (`one-oscuro/5`, `/10`, `/40`, `/60`).
- **Blanco Puro** (`#fefeff`): fondo base de toda pantalla del panel (no `#ffffff` puro — el kit
  de marca ya define este blanco ligeramente cálido).
- **Lavanda** (`#a4a8c0`): texto secundario sobre fondo oscuro (login).
- **Gris Claro** (`#c6c9d7`): bordes/divisores sutiles sobre fondo oscuro.

### Named Rules
**La Regla de la Rareza Fucsia.** El acento primario ocupa como mucho UN elemento por pantalla con
intención real de destacar (el CTA principal, el ítem activo). Si dos elementos compiten por
fucsia en la misma vista, uno de los dos está mal — bajarlo a outline/neutro.

**La Regla de los Badges Neutros.** Una fila de tabla o tarjeta tiene como mucho UN badge de
color (el dato más importante); cualquier badge adicional va en `bg-one-oscuro/5 text-one-oscuro/60`,
sin color propio.

## 3. Typography

**Display Font:** Exo 2 (con `system-ui, sans-serif` de fallback)
**Body Font:** Exo 2 — misma familia en toda la interfaz, la jerarquía la da el peso/tamaño, nunca
un segundo tipo de letra.

**Character:** Geométrica, técnica pero cálida — ni corporativa fría ni redondeada-juguetona.

### Hierarchy
- **Display** (extrabold 800, `1.5rem`/24px, line-height 1.2): título de página (`<h1>` de cada
  pantalla del panel — "Usuarios del panel", "Campañas", etc.).
- **Headline** (extrabold 800, `1.125rem`/18px): título de sección dentro de una pantalla ("Crear
  usuario", nombre de un modal).
- **Title** (bold 700, `0.875rem`/14px): encabezado de subsección, nombre de tarjeta de stat.
- **Body** (regular 400, `0.875rem`/14px, line-height 1.5): texto de tabla, contenido de formulario,
  copy general. Máximo ~70ch en párrafos largos (poco frecuentes en este panel).
- **Label** (semibold 600, `0.75rem`/12px, tracking +0.02em): labels de campo de formulario,
  encabezado de columna de tabla, metadatos (fecha, estado).

### Named Rules
**La Regla del Peso, No el Color.** La jerarquía tipográfica se comunica con peso (`font-bold` /
`font-extrabold`) y tamaño, nunca coloreando texto para que "resalte" — el color se reserva para
estado (error, éxito, alerta), no para énfasis tipográfico.

## 4. Elevation

Sistema de capas sutiles, sombra solo como respuesta. En reposo, las superficies son casi planas
(`shadow-one-sm`, casi imperceptible) — la sombra crece de verdad recién cuando el usuario
interactúa (`shadow-one-md` en hover), nunca como decoración estática de una tarjeta en reposo.

### Shadow Vocabulary
- **`shadow-one-sm`** (`0 1px 2px rgba(26,24,29,0.04), 0 1px 1px rgba(26,24,29,0.03)`): estado de
  reposo de cualquier tarjeta/contenedor — casi invisible a propósito.
- **`shadow-one-md`** (`0 12px 24px -8px rgba(26,24,29,0.16), 0 4px 8px -4px rgba(26,24,29,0.08)`):
  hover de tarjeta interactiva, elemento con foco real.
- **`shadow-one-lg`** (`0 24px 48px -12px rgba(26,24,29,0.28), 0 8px 16px -4px rgba(26,24,29,0.12)`):
  modal/popover — el único caso donde el elemento necesita separarse de verdad del fondo.
- **`shadow-one-fucsia`** (`0 12px 28px -8px rgba(225,123,215,0.35)`): sombra con color de marca,
  reservada para EL elemento más importante de una pantalla puntual — nunca un grid completo.

### Named Rules
**La Regla del Reposo Plano.** Ninguna superficie lleva sombra visible en estado idle salvo un
modal/popover. Si una tarjeta "necesita" sombra para verse bien en reposo, el problema es de
contraste de fondo, no de falta de sombra.

## 5. Components

### Buttons
- **Shape:** píldora completa (`rounded-full`, 9999px) — nunca esquina dura ni radio chico en un
  botón.
- **Primary:** fondo `one-fucsia` sólido, texto `one-negro` (nunca blanco — falla contraste),
  padding `10px 24px`, peso `font-bold`. Uno por pantalla como mucho.
- **Secondary/Ghost:** fondo transparente, borde `one-oscuro/15`, texto `one-oscuro` — toma
  `one-oscuro/5` de fondo en hover. Es la opción por default para cualquier acción que no sea LA
  acción primaria de la pantalla.
- **Hover / Focus:** `translateY(-2px)` + transición explícita de `transform` (nunca
  `transition-all` — anima solo lo que cambia), 200-300ms `ease-out`. Foco visible con
  `ring-2 ring-one-fucsia/40`.

### Cards / Containers
- **Corner Style:** `rounded-one-lg` (24px) para contenedores de página, `rounded-one-sm` (8px)
  para elementos chicos dentro (badges, chips).
- **Background:** `one-blanco` con borde `one-oscuro/10`, o relleno plano `one-oscuro/5` para
  agrupaciones internas (sin borde).
- **Shadow Strategy:** `shadow-one-sm` en reposo, `shadow-one-md` en hover si es interactiva.
- **Internal Padding:** `20-24px` (`p-5`/`p-6`).

### Inputs / Fields
- **Style:** fondo `one-blanco`, borde `one-oscuro/15`, `rounded-one-sm`.
- **Focus:** borde `one-fucsia` + `ring-2 ring-one-fucsia/20` — nunca el outline default del
  navegador.
- **Error:** borde/texto `one-rojo`, nunca solo color sin mensaje de texto acompañando.

### Navigation (Sidebar)
- Fondo `one-oscuro` sólido, ítems con ícono + label, colapsable. Ítem activo: fondo
  `one-fucsia/15`, texto `one-fucsia` — el único lugar del sidebar con color de marca. Resto:
  `one-lavanda` en reposo, `one-blanco` en hover.

### Badges / Estado
- Un solo color con significado real por fila: `emerald` (`#059669`) para activo/éxito, `one-rojo`
  para error/deshabilitado, `one-oscuro/5` neutro para cualquier otro dato — nunca un color
  distinto por cada atributo de la fila.

## 6. Do's and Don'ts

### Do:
- **Do** usar `one-fucsia` sólido para UN SOLO botón por pantalla — el resto, outline/ghost.
- **Do** dejar las tarjetas casi planas en reposo (`shadow-one-sm`) y subir la sombra recién en
  hover (`shadow-one-md`).
- **Do** usar `one-cian` y `one-dorado` como acentos secundarios reales en más pantallas — hoy
  casi solo existen en el login.
- **Do** animar `transform`/`opacity`/`colors` explícitos, nunca `transition-all`.
- **Do** respetar `prefers-reduced-motion` en toda animación nueva.

### Don't:
- **Don't** usar gradiente de fondo en una sección completa — el gradiente se reserva para texto
  de título puntual (`bg-clip-text`) o un acento de 2-3px, nunca como fondo de una superficie
  grande.
- **Don't** poner glow/ambient light dentro de cada tarjeta de un listado — eso es lo genérico-IA
  que este sistema rechaza explícitamente.
- **Don't** usar 3 o más badges de color distinto en la misma fila/tarjeta — un badge con color
  real (el dato más importante), el resto neutro.
- **Don't** aplicar sombra fuerte a una tarjeta en estado de reposo — la sombra comunica
  interacción, no decoración.
- **Don't** usar `border-left`/`border-right` de más de 1px como acento de color en tarjetas o
  filas — si hace falta un acento de fila, usar la barra de 3px SOLO en hover (`.table-row-hover`
  de `globals.css`), nunca fija.
- **Don't** tocar lógica de negocio, Server Actions ni validaciones al aplicar este sistema — es
  puramente visual (clases, CSS, layout).
