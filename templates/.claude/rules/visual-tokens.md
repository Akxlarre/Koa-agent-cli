---
enforcement: mecanizada  # ARCH-11, ARCH-15, ARCH-16, ARCH-17, ARCH-18, ARCH-19, ARCH-22, ARCH-23, ARCH-24, ARCH-25, ARCH-26
paths:
  - "src/app/**/*.html"
  - "src/app/**/*.scss"
  - "src/app/shared/**/*.ts"
  - "src/app/features/**/*.ts"
  - "src/app/layout/**/*.ts"
  - "src/styles/**/*.scss"
---

# Sistema Visual — Tokens

> Color, iconos, tipografía, temas y lo que el linter detecta sobre clases del DS.
> Los patrones de composición —App-like, bento, skeletons, animaciones— están en
> `visual-patterns.md`, que solo se carga al editar `features/` o `layout/`.

## Tokens de color (PROHIBIDO hardcodear)

- Textos: `text-primary`, `text-secondary`, `text-muted`
- Fondos: `bg-canvas` (página), `bg-surface` (cards), `bg-surface-elevated`
- Marca: `var(--ds-brand)`, `var(--color-primary)`
- **NUNCA**: `text-red-500`, `bg-[#ff0000]`, u otras utilities de colores arbitrarios de Tailwind. Usa siempre variables abstractas.

## Iconos — Sistema Lucide (OBLIGATORIO)

- **PROHIBIDO** usar emojis como iconos de UI (❌ `✅`, `⚠️`, `🔒`, `📊`)
- **OBLIGATORIO** usar `<app-icon name="..." />` para todo ícono de interfaz
- Selector: `app-icon` | inputs: `name` (requerido), `size` (default 16), `color`, `ariaHidden`
- Nombres en kebab-case igual que en lucide.dev (ej: `"trending-up"`, `"trash-2"`)
- Para agregar un ícono nuevo: importarlo de `'lucide-angular'` y registrarlo en `provideIcons()` en `app.config.ts`
- **NUNCA** insertar `<svg>` inline ad-hoc — siempre pasar por `<app-icon>`

## Vocabulario tipográfico (OBLIGATORIO)

Cuatro clases cubren el 90% de la tipografía de la app. **Usarlas siempre en lugar de recomponer
utilities de Tailwind** — cada recomposición a mano es un punto de divergencia. En un proyecto
real esta regla nació después de encontrar 221 micro-labels escritos a mano en 25 variantes
distintas, con 14 archivos mezclando varias entre sí.

| Clase | Qué es | Reemplaza a |
|---|---|---|
| `.kpi-value` | Número KPI principal | `text-4xl font-bold` |
| `.micro-label` | **Micro-label uppercase** — label de KPI, cabecera de grupo, título de columna, etiqueta de campo en lectura | `text-xs uppercase tracking-* font-* text-text-muted` |
| `.item-title` | Título de fila / card / ítem de lista | `text-sm font-semibold text-text-primary` |
| `.section-eyebrow` | Línea de contexto **legible** antes de un título (sin uppercase) | `text-sm text-text-secondary` |

Combinar con `.card-tinted` para máximo contraste visual en KPIs.

```html
<!-- CORRECTO -->
<div class="card-tinted">
  <span class="micro-label">Usuarios activos</span>
  <span class="kpi-value">24.8K</span>
</div>

<!-- INCORRECTO -->
<div>
  <p class="text-xs text-gray-500 uppercase">Usuarios activos</p>
  <p class="text-4xl font-bold">24.8K</p>
</div>
```

> **`.kpi-label` es un alias deprecado de `.micro-label`.** Sigue funcionando; no usarla en
> código nuevo.
>
> **`.micro-label` no tiene restricción de alcance** — es para cualquier micro-label en
> mayúsculas, no solo para KPIs. Restringirla a datos numéricos es precisamente lo que empuja a
> la gente a recomponer la clase a mano cuando la necesita en otro contexto.
>
> ⚠️ **No nombrar una clase del DS igual que una utility "bare" de Tailwind.** Esta clase se
> llamó `.overline` hasta que se detectó la colisión: `overline` es también una utilidad nativa
> de Tailwind (`text-decoration-line: overline`), así que Tailwind generaba su propia regla en
> `@layer utilities` que **se sumaba** (no reemplazaba) al estilo del DS, dibujando una línea
> física encima del texto. Renombrar fue la única forma de eliminarla de raíz.
>
> La distinción que **sí** importa es `.micro-label` (uppercase, micro, `text-muted`) vs
> `.section-eyebrow` (`text-sm`, natural, `text-secondary`): la primera etiqueta un dato, la
> segunda da contexto legible antes de un título.

## Lo que el linter ya detecta — ARCH-11, 15–19, 22, 24, 25, 26

Diez reglas mecánicas que `npm run lint:arch` verifica y cuyo mensaje de error **ya trae el
fix completo**. No se documentan acá en prosa: leerlas en cada edición cuesta contexto todos
los días para prevenir algo que se detecta el día que pasa.

<a id="arch-11"></a><a id="arch-15"></a><a id="arch-16"></a><a id="arch-17"></a>
<a id="arch-18"></a><a id="arch-19"></a><a id="arch-22"></a>
<a id="arch-24"></a><a id="arch-25"></a><a id="arch-26"></a>

| Regla | Qué recompone a mano |
|---|---|
| ARCH-15 | Pill/badge: `rounded-full` + micro-texto + `px-` |
| ARCH-16 | Utilities de tamaño encima de un `.btn-*` |
| ARCH-17 | `text-[NNpx]` fuera de la escala |
| ARCH-19 | El cluster tipográfico que ya es `.micro-label` / `.item-title` |
| ARCH-24 | El cluster de un campo que ya es `.field-input` / `.field-label` |
| ARCH-11 | Clase de token que no existe en `@theme`: no genera CSS y no falla |
| ARCH-18 | Alias "pelado" dentro del propio `@theme` |
| ARCH-22 | Clase del DS con el nombre de una utilidad nativa: se **suman**, no se reemplazan |
| ARCH-25 | Par texto/fondo por debajo de AA, en cualquiera de los dos temas |
| ARCH-26 | Token del `@theme` con nombre de escala nativa (`--color-base` → `text-base`) |

Lo que el mensaje de error **no** puede decirte, y por eso queda escrito:

- **ARCH-15/16/17/19/24 son ratcheadas.** `scripts/lib/class-discipline.baseline.json` registra
  la deuda tolerada por archivo y solo se reporta una regresión. Koa arranca **sin baseline**:
  tolerancia cero. Se adopta deuda a propósito con `npm run lint:arch -- --update-ds-baseline`.
- **ARCH-25 solo mide los pares que alguien declaró.** Al agregar un par texto/fondo nuevo al
  DS, agregalo a `PARES_CANONICOS` en `scripts/lib/contrast-check.js`. Un par que nadie mide es
  un par que nadie garantiza. Los fondos semi-transparentes se componen sobre `--bg-base` antes
  de medir: el contraste real es el del color compuesto.
- **El principio detrás de todas:** recomponer a mano algo que el Design System ya resuelve.
  Cuando dudes entre una clase del DS y un cluster de utilities, es el DS.

> Las diez —y ARCH-23, que vive con el patrón App-like— tienen fixture de provocación (`npm run lint:arch:provocar`): están probadas
> disparando ante su propia violación. Por eso su prosa pudo salir de acá — cambiar prevención
> por detección solo es honesto cuando la detección está probada.

## Modo claro/oscuro

- Controlado por `ThemeService` con `[data-mode='dark']` en el documentElement
- `this.themeService.setColorMode('dark' | 'light' | 'system')`
- PrimeNG: usar `darkModeSelector: '.fake-dark-mode'` para evitar conflictos

## Personalización de marca por cliente (Multi-Brand)

Cuando un cliente requiere colores corporativos distintos al default, **no crees un tema paralelo ni dupliques tokens**. El sistema de 4 capas ya lo soporta:

### Cómo aplicar

Sobreescribir **solo Layer 3 (Brand)** en `_variables.scss`:

```scss
// Antes (default del Blueprint)
:root {
  --ds-brand: #0ea5e9;
  --color-primary-hover: #0284c7;
  --gradient-hero: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%);
}
[data-mode="dark"] {
  --ds-brand: #38bdf8;
  --color-primary-hover: #7dd3fc;
}

// Después (cliente "Acme Corp" con verde corporativo)
:root {
  --ds-brand: #16a34a;
  --color-primary-hover: #15803d;
  --gradient-hero: linear-gradient(135deg, #16a34a 0%, #059669 100%);
}
[data-mode="dark"] {
  --ds-brand: #4ade80;
  --color-primary-hover: #86efac;
}
```

### Reglas

- **SOLO** tocar Layer 3 (brand, gradientes, estados). Layers 1, 2 y 4 no cambian.
- El dark mode del brand **debe cumplir WCAG AA** (contraste ≥ 4.5:1 sobre `--bg-surface`). Verificar en [webaim.org/resources/contrastchecker](https://webaim.org/resources/contrastchecker/).
- Los component tokens (Layer 4) como `--btn-primary-bg: var(--ds-brand)` heredan automáticamente — no necesitan cambios.
- **NUNCA** crear selectores `[data-brand="x"]` ni CSS condicional por cliente. Un proyecto = una marca. Si necesitas multi-tenant runtime, eso es una feature distinta que requiere `ThemeService` extendido.
