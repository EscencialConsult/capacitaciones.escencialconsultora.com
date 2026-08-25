# Product

## Register

product

## Users

Facundo y 1-2 admins más de Escencial Consultora, en uso diario, entre otras tareas — nunca de
cara a un cliente externo. Entran al panel para armar campañas de landings (elegir plantilla,
cargar contenido, configurar el goteo de hasta 4 emails), revisar leads capturados, gestionar
plantillas de landing/email, conectar los proveedores de envío (Brevo/Resend) y administrar
usuarios del panel. El contexto típico es "resolver esto rápido y volver a lo que estaba haciendo"
— no exploración, no sesiones largas navegando por gusto.

## Product Purpose

Reemplaza un sistema anterior de Google Sheets + Apps Script para armar landings de captación de
leads con seguimiento automático por email. El panel es la única interfaz de administración: sin
él, no hay forma de crear una campaña, ver quién se registró, ni gestionar el envío de emails.
Éxito = un admin sin conocimientos técnicos profundos puede crear una campaña completa (landing +
contenido + secuencia de emails) sin ayuda, y confía en que lo que ve en el panel (leads, estado
de envíos, campañas activas) es exactamente lo que está pasando en producción.

## Brand Personality

Premium, preciso, ágil. Se tiene que sentir cuidado y de nivel alto (misma marca que las landings
públicas que este mismo sistema genera — ver `lib/landing-template-defaults.ts`, que ya tiene un
sistema de diseño elaborado y anti-genérico para esas páginas), pero la prioridad número uno es
que cada pantalla resuelva rápido la tarea puntual — nunca decoración que se interponga entre el
admin y la acción que vino a hacer. "Premium" se expresa en el detalle (tipografía, espaciado,
micro-interacciones, sistema de color coherente), no en volumen de elementos visuales.

## Anti-references

Lo genérico-IA de siempre: gradientes aplicados por todos lados (no solo donde suman), glow/ambient
light dentro de cada tarjeta de una lista, badges de 3+ colores distintos en una misma fila, cards
idénticas repetidas en grilla sin ninguna jerarquía entre ellas, sombras fuertes en estado de
reposo, opacidades sueltas sin sistema. Ver la skill `anti-ia` de este mismo entorno para el
checklist completo — se aplica como filtro de calidad en cada pantalla que se rediseñe acá.

## Design Principles

1. **El detalle es el lujo, no el volumen.** Elaborado significa espaciado cuidado, tipografía con
   jerarquía real, micro-interacciones con propósito y un sistema de color usado con intención —
   no más elementos por pantalla.
2. **Tratamiento especial reservado para lo que lo amerita.** Gradiente, glow o sombra de marca
   solo en el CTA principal, el ítem seleccionado/recomendado, o una alerta real — nunca aplicado
   de forma pareja a todo un listado.
3. **Coherencia entre pantallas por encima de creatividad puntual.** Un mismo componente (tarjeta,
   botón, badge, tabla) se ve y se comporta igual en Campañas que en Usuarios que en Integraciones
   — el sistema de diseño es una sola fuente de verdad (ver DESIGN.md), no una interpretación libre
   por pantalla.
4. **Rápido desde el primer load, no solo en cargas siguientes.** Nada de animación pesada en JS,
   nada de librerías nuevas de peso, imágenes optimizadas, Server Components por default — la
   sensación de "premium" nunca puede costar velocidad real.
5. **Nunca tocar lógica de negocio para lograr esto.** El sistema ya pasó por varias rondas de
   corrección de bugs reales (validaciones, seguridad, integridad de datos) — el rediseño es
   estructura visual (clases, CSS, layout), nunca una reescritura de Server Actions, validaciones
   ni comportamiento ya verificado.

## Accessibility & Inclusion

WCAG AA como piso — contraste real (nunca gris claro "por elegancia" sobre fondo casi blanco,
ver General rules de la skill impeccable), foco visible en todo elemento interactivo, formularios
con label asociado (no solo placeholder), y `prefers-reduced-motion` respetado en toda animación
nueva (patrón ya establecido en `app/globals.css`). Sin requisito de accesibilidad más allá de
esto — no hay usuarios con necesidades específicas conocidas hoy, pero el piso AA no es opcional.
