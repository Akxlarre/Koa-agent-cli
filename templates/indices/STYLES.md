<!-- spec-version: {{GENERATED_AT}} -->
<!-- auto-refresh: indices:sync -->

# Registro de Estilos & Design System

> **Regla de Actualización:** El Agente debe consultar esta tabla ANTES de crear estilos nuevos. Si ya existe una clase o token que resuelve la necesidad, **reutilizar**. Añadir a esta tabla cada vez que se cree un archivo de estilos nuevo.

## Design Tokens

| Archivo | Responsabilidad | Ubicación | Estado |
|---------|----------------|-----------|--------|
| `_variables.scss` | Tokens del Design System (4 capas): escala (colores, espaciado, radios, tipografía, motion), semántica (superficies, texto, bordes, sombras, estados), marca (brand, gradientes, acciones), componentes (btn, input, card, motion). Light + Dark mode. | `styles/tokens/_variables.scss` | ✅ Estable |

## Utilities (Tailwind v4)

| Archivo | Responsabilidad | Ubicación | Estado |
|---------|----------------|-----------|--------|
| `tailwind.css` | Capa de utilidades Tailwind v4. Mapea tokens del design system vía `@theme` para clases como `text-text-secondary`, `bg-surface`, `rounded-lg`. Incluye `@utility btn-primary`, `@utility btn-secondary` y `@utility btn-ghost` (3 tiers de botones del DS). No usa Preflight (PrimeNG tiene su propio reset). | `src/tailwind.css` | ✅ Estable |
| `postcss.config.json` | Configuración PostCSS para Tailwind v4. **Tiene que ser `.json`**: el builder `@angular/build:application` ignora `.js`/`.mjs`/`.cjs` y Tailwind queda sin procesar sin ningún error visible. | `postcss.config.json` (root) | ✅ Estable |

## Layout

| Archivo | Clases principales | Ubicación | README | Estado |
|---------|-------------------|-----------|--------|--------|
| `_bento-grid.scss` | Proporciones: `.bento-grid`, `.bento-square`, `.bento-wide`, `.bento-tall`, `.bento-feature`, `.bento-hero`, `.bento-banner`, `.bento-card`, `.bento-media` + data-attributes de placement. **App-like**: `.bento-grid--fill-screen`, `--fill-screen-2`, `--fill-screen-kpi`, `--hero-fit`, `--rows-fit` y `.bento-fill`. Responde a `@container layoutmain`, **no** a `@media`. | `styles/layout/_bento-grid.scss` | `_bento-grid.README.md` | ✅ Estable |
| `_page-shell.scss` | `.page-centered`, `.page-narrow`, `.page-content`, `.page-wide`, `.page-split`, `.page-header`, `.page-section`, `.page-empty` + buffer de `@media (display-mode: fullscreen)` para F11/PWA. | `styles/layout/_page-shell.scss` | `_page-shell.README.md` | ✅ Estable |

## Motion

| Archivo | Responsabilidad | Ubicación | README | Estado |
|---------|----------------|-----------|--------|--------|
| `_view-transitions.scss` | View Transitions API: navegación (page-out/in asimétrico) + theme switch (reveal circular desde el clic). Requiere `view-transition-name: main-content` en el `<main>` del app-shell. | `styles/motion/_view-transitions.scss` | `_view-transitions.README.md` | ✅ Estable |
| `_animations.scss` | Fallback CSS puro sin JS: `.animate-fade-in-up`, `.animate-fade-in`, `.animate-stagger`. Es global (no estilo de componente), así que sus `@keyframes` están exentos de ARCH-07. | `styles/_animations.scss` | — | ✅ Estable |

## Vendors

| Archivo | Responsabilidad | Ubicación | Estado |
|---------|----------------|-----------|--------|
| `_primeng-overrides.scss` | Mapeo de tokens PrimeNG al Design System: toast, button, avatar, badge, table, stepper, datepicker, select, skeleton, breadcrumb, menu y fixes de dark mode. Cero colores hardcodeados; todo vía `var(--*)`. | `styles/vendors/_primeng-overrides.scss` | ✅ Estable |

## Vocabulario de clases semánticas (`_variables.scss`)

> Estas clases existen para que nadie recomponga el mismo cluster de utilities a mano.
> El linter las enforza: ARCH-19 detecta clusters ad-hoc y ARCH-15 pills ad-hoc.

| Clase | Qué es | Reemplaza a |
|---|---|---|
| `.kpi-value` | Número KPI principal | `text-4xl font-bold` |
| `.micro-label` | Micro-label uppercase (label de KPI, cabecera de grupo, título de columna) | `text-xs uppercase tracking-* text-text-muted` |
| `.item-title` | Título de fila / card / ítem de lista | `text-sm font-semibold text-text-primary` |
| `.section-eyebrow` | Línea de contexto legible antes de un título (sin uppercase) | `text-sm text-text-secondary` |
| `.badge-count` | Badge numérico superpuesto (notificaciones) | `rounded-full + text-[10px] + px-1` a mano |
| `.surface-hero` / `.surface-glass` | Jerarquía de superficies | — |
| `.indicator-live` / `.badge-pulse` | Indicadores de actividad | — |

> `.kpi-label` es alias **deprecado** de `.micro-label`. Sigue funcionando; no usar en código nuevo.
>
> ⚠️ Al crear una clase del DS, no le pongas el nombre de una utilidad "pelada" de Tailwind
> (`.truncate`, `.overline`, …): Tailwind genera su propia regla homónima en `@layer utilities`
> que **se suma** a la tuya en vez de reemplazarla. ARCH-22 lo bloquea.

## Cómo elegir una celda bento

<a id="arch-21"></a>
> El sistema bento está **congelado por allowlist** (ARCH-21): agregar una clase
> `.bento-*` a `_bento-grid.scss` sin sumarla a `scripts/lib/bento-classes.allowlist.json`
> hace fallar `npm run lint:arch`. El freno existe porque este grid tiende a crecer por
> acumulación: cada pantalla suma "una clasecita más" hasta que hay treinta y ninguna se
> puede borrar sin miedo.

**El bento describe FORMAS, no contenidos.** Si el nombre que se te ocurre alude a la
sección de la app que lo usa (`bento-facturas`, `bento-actividad-lg`), es señal de que
la necesidad se resuelve con lo que ya hay.

Árbol de decisión, en orden:

1. **¿Alguna proporción existente sirve?** → `.bento-square` (1×1), `.bento-wide` (2:1),
   `.bento-tall` (1×2), `.bento-feature` (protagonista), `.bento-hero` (full-width),
   `.bento-banner` (full-width, 1 fila).
2. **¿Necesitás una medida puntual?** → data-attributes de placement:
   `data-col-span`, `data-row-span`, `data-col-start`. No requieren clase nueva.
   Ej. dos paneles 50/50 a la misma altura: `data-col-span="6"` en cada celda.
3. **¿Es un comportamiento del grid entero?** → modificador en el contenedor:
   `--four-equal`, `--hero-fit`, `--rows-fit`, `--wizard`, o los `--fill-screen*` del
   patrón App-like.
4. **Solo si nada de lo anterior alcanza** → clase nueva + entrada en el allowlist con
   una línea explicando por qué no bastaba.

> ⚠️ Dentro de un grid `--fill-screen*` el paso 1 se recorta: `.bento-tall`, `.bento-feature`
> y `.bento-hero` ocupan **2 filas** y desbordan el `grid-template-rows` explícito, así que
> las celdas terminan superpuestas sin que el navegador avise. Ahí toda celda hija va en
> `.bento-banner` (1 fila) y lo que necesite subdividirse se anida adentro. ARCH-23 lo caza.

## Estilos Globales (`styles.scss`)

| Concepto | Clases/Selectores | Propósito |
|----------|-------------------|-----------|
| Scroll locks | `body.layout-drawer-open`, `body.modal-open` | Bloqueo de scroll en drawer mobile y modales |
| Modal overlay | `.modal-overlay__wrapper` | Posicionamiento fijo del overlay de modales (z-index > topbar) |

<!-- DETAIL:BEGIN -->
## Reglas de Uso

1. **Layouts de página**: usar `.page-centered`, `.page-narrow`, `.page-wide`, etc. — NO crear max-width ad-hoc
2. **Grids de dashboard**: usar `.bento-grid` con clases de proporción — NO crear grids custom
3. **Colores y espaciado**: usar tokens `var(--*)` de `_variables.scss` — NUNCA valores hex/px directos
4. **Componentes PrimeNG**: los overrides ya están en `_primeng-overrides.scss` — NO sobrescribir en componentes individuales
5. **Animaciones de página**: usar View Transitions API (`_view-transitions.scss`) — NO crear transiciones de ruta custom
6. **Tipografía**: usar el vocabulario de clases semánticas — NO recomponer clusters de utilities
7. **Tamaños de fuente**: usar la escala (`--text-2xs` … `--text-5xl`) — NUNCA `text-[NNpx]` arbitrario (ARCH-17)
8. **Breakpoints del bento**: el grid escucha a `@container layoutmain`, no al viewport. El `<main>` DEBE declarar `container-type: inline-size; container-name: layoutmain` o el grid colapsa a 1 columna

## Auto-Index — Detectado por AST (generado automáticamente)

<!-- AUTO-GENERATED:BEGIN -->
_Sin entradas auto-detectadas aún. Ejecuta `npm run indices:sync` para poblar._
<!-- AUTO-GENERATED:END -->
