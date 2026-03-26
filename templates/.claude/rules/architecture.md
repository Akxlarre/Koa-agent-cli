---
paths:
  - "src/app/**/*.ts"
  - "src/app/**/*.html"
---

# Reglas Arquitectónicas

## Estructura de carpetas canónica

```text
src/
├── app/
│   ├── core/         # Facades, Guards, Interceptors, Modelos, Utils
│   ├── features/     # Smart Components (páginas enrutables)
│   ├── shared/       # Dumb Components (UI presentacional)
│   └── layout/       # Sidebar, Topbar, Shell
├── styles/
│   ├── tokens/       # SCSS variables — NUNCA hardcodear en componentes
│   └── vendors/      # PrimeNG overrides
supabase/
└── migrations/       # SQL idempotentes — NUNCA alterar BD manualmente
```

## Patrón Facade y Núcleo Funcional (Functional Core)

- La UI **NUNCA** inyecta `SupabaseService`, `HttpClient`, ni clientes REST directamente.
- **SIEMPRE** usar un `*FacadeService` que centraliza estado vía Signals.
- El Facade expone data al template con `toSignal()`.
- **NÚCLEO FUNCIONAL (Functional Core):** No acumules lógica compleja, matemática pesada o transformaciones de datos algorítmicas dentro de la Facade ni en los componentes. Extrae esa inteligencia a **funciones puras** de TypeScript (Data Out, Data In) en `core/utils/`. Esto permite testear la lógica del negocio instantáneamente sin levantar inyecciones de Angular.

## Funciones Puras (`core/utils/`)

Ubicación obligatoria para lógica de negocio reutilizable que **no depende de estado ni inyecciones**:

```text
core/utils/
├── sales.utils.ts       # Rankings, agregaciones de ventas
├── date.utils.ts        # Formateo, parsing, comparaciones
├── validation.utils.ts  # Validadores de email, RFC, etc.
└── index.ts             # Barrel export
```

### Cuándo crear una util

- Lógica de combinación/agregación que se repite en **2+ Smart Components**
- Cálculos puros (rankings, porcentajes, filtros complejos) que ensucian un `computed()`
- Transformaciones de datos que no requieren estado de Angular

### Cuándo NO crear una util

- Lógica que solo se usa en 1 lugar → dejarla inline en el `computed()` del Smart Component
- Lógica que necesita estado reactivo → pertenece al Facade
- Wrappers triviales de una línea → no agregan valor

### Convenciones

- Archivo: `{dominio}.utils.ts` (kebab-case)
- Funciones: puras, sin side effects, sin `inject()`, sin `signal()`
- Exports: siempre a través del barrel `core/utils/index.ts`
- Tests: cada `*.utils.ts` debe tener su `*.utils.spec.ts` — son las más fáciles de testear

## Detección de cambios

- `changeDetection: ChangeDetectionStrategy.OnPush` en **TODOS** los componentes

## Signals & RxJS

- `signal()` → estado sincrónico UI (contadores, modales, toggles)
- `RxJS` → flujos asíncronos en Servicios
- `toSignal()` → exponer RxJS a templates en el Facade

## Templates

- **PROHIBIDO**: `*ngIf`, `*ngFor`, `ngClass`, `ngStyle`, `@Input()`, `@Output()`
- **OBLIGATORIO**: `@if`, `@for`, `[class.active]`, `[style.width.px]`, `input()`, `output()`

## Smart vs Dumb Components

- **Dumb (`shared/`)**: Solo `input()` y `output()`. Sin inyección de Facades.
- **Smart (`features/`)**: Inyectan Facades. Coordinan Dumb Components.
- **Skeleton colocated**: Cada Dumb que recibe data async tiene su `{nombre}-skeleton.component.ts` al lado

## Clases Semánticas vs Tailwind Genérico

En componentes de presentación (`shared/`), **preferir siempre** las clases semánticas del design system sobre la composición directa de utilities Tailwind:

| Necesidad | CORRECTO | PROHIBIDO |
|---|---|---|
| Número KPI grande | `.kpi-value` | `text-4xl font-bold tracking-tight` |
| Etiqueta de KPI | `.kpi-label` | `text-xs text-gray-500 uppercase` |
| Banner/Hero section | `.surface-hero` | `bg-gradient-to-br from-blue-600 to-purple-600` |
| Overlay glass | `.surface-glass` | `bg-white/90 backdrop-blur-md border` |
| Estado activo/online | `.indicator-live` | `inline-flex gap-2 before:w-2 before:bg-green-500` |

**Regla general**: Tailwind para spacing, sizing y layout (`p-4`, `flex`, `grid`, `w-full`, `gap-3`). Clases semánticas del DS para identidad visual, tipografía dramática y superficies.
