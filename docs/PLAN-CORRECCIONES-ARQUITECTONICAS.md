# Plan de Correcciones Arquitectonicas — KOA Blueprint v6.x

> Fecha: 2026-03-27
> Origen: Auditoria de alineacion KOA Blueprint vs estandares de la industria 2025-2026
> Prerequisito: v6.0 completado. Este plan es independiente del roadmap v7.0 (docs/tareas.md)
> Prioridad: Estas correcciones deben aplicarse ANTES de iniciar v7.0, ya que afectan el boilerplate base

---

## Resumen Ejecutivo

La auditoria identifico 5 correcciones necesarias para alinear KOA con los estandares de la industria:

| # | Correccion | Prioridad | Esfuerzo | Impacto |
|---|-----------|-----------|----------|---------|
| C-1 | Migrar testing a Vitest | ALTA | 1 sesion | Proyectos generados usan el runner oficial de Angular 21+ |
| C-2 | GSAP como opt-in (no obligatorio) | MEDIA-ALTA | 1 sesion | Reduce friccion, alinea con web standards |
| C-3 | NgRx Signal Store como opcion | MEDIA | 1 sesion | Cubre tier enterprise de state management |
| C-4 | Agregar AGENTS.md portable | MEDIA | 0.5 sesion | Compatibilidad multi-tool AI (Cursor, Copilot, Windsurf) |
| C-5 | E2E testing setup | MEDIA | 1 sesion | Completa la piramide de testing |

**Total estimado: 4-5 sesiones de trabajo**

---

## C-1: Migrar Testing a Vitest

### Contexto

Angular 21 (2025) reemplazo Karma por **Vitest** como test runner por defecto. `ng new` genera configuracion Vitest + jsdom automaticamente. KOA genera proyectos que asumen Karma/Jasmine implicitamente, lo cual es obsoleto para Angular 20+.

**Fuente**: [angular.dev/guide/testing/migrating-to-vitest](https://angular.dev/guide/testing/migrating-to-vitest)

### Alcance

#### 1.1: Dependencias en bin/index.js

**Archivo:** `bin/index.js`

Modificar la lista de devDependencies que se instalan durante el scaffold:

```diff
- "karma", "karma-chrome-launcher", "karma-coverage", "karma-jasmine", "karma-jasmine-html-reporter"
+ "vitest", "@analogjs/vitest-angular", "jsdom"
```

**Nota:** Si el proyecto usa `ng new` como base y luego inyecta, Angular 21+ ya incluye Vitest. Verificar si `ng new` en la version target ya lo trae — si es asi, solo asegurar que NO se instalen deps de Karma.

#### 1.2: Configuracion de Vitest

**Archivo nuevo:** `templates/boilerplate/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vitest-angular';

export default defineConfig({
  plugins: [angular()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['src/test-setup.ts', '**/*.spec.ts', '**/*.skeleton.*']
    }
  }
});
```

**Archivo nuevo:** `templates/boilerplate/src/test-setup.ts`

```typescript
import '@analogjs/vitest-angular/setup-zone';
```

#### 1.3: Eliminar configuracion Karma

**Archivos a eliminar del boilerplate (si existen):**
- `templates/boilerplate/karma.conf.js`
- `templates/boilerplate/src/test.ts` (bootstrap de Karma)

**Archivo a modificar:** `templates/boilerplate/angular.json`
- Reemplazar el builder de test:
```diff
- "builder": "@angular-devkit/build-angular:karma"
+ "builder": "@angular-devkit/build-angular:vitest"
```

#### 1.4: Scripts de package.json

**Archivo:** `templates/boilerplate/package.json` (o la seccion donde se genera)

```diff
- "test": "ng test"
- "test:ci": "ng test --watch=false --browsers=ChromeHeadless"
+ "test": "ng test"
+ "test:watch": "ng test --watch"
+ "test:ci": "ng test --watch=false --reporter=verbose"
+ "test:coverage": "ng test --watch=false --coverage"
```

#### 1.5: Migrar spec files del boilerplate

**Archivos afectados:** Todos los `.spec.ts` en `templates/boilerplate/src/`

Cambios necesarios en cada spec:
```diff
- import { TestBed } from '@angular/core/testing';
+ import { TestBed } from '@angular/core/testing';
+ import { describe, it, expect, beforeEach, vi } from 'vitest';
```

- Reemplazar `jasmine.createSpy()` → `vi.fn()`
- Reemplazar `jasmine.createSpyObj()` → objeto con `vi.fn()` por metodo
- Reemplazar `spyOn()` → `vi.spyOn()`
- Reemplazar `.and.returnValue()` → `.mockReturnValue()`
- Reemplazar `.toHaveBeenCalledWith()` → (se mantiene, compatible)

**Nota:** Si los specs son pocos en el boilerplate, migrar manualmente. Si son muchos, usar regex batch.

#### 1.6: Actualizar regla TDD

**Archivo:** `templates/.claude/rules/testing-tdd.md`

Actualizar referencias:
```diff
- Usar Jasmine/Karma como test runner
+ Usar Vitest como test runner (Angular 21+ default)
- `npm run test -- --watch=false --browsers=ChromeHeadless`
+ `npm run test:ci`
```

Agregar seccion de mocks:
```markdown
## Mocking con Vitest
- `vi.fn()` para crear mocks
- `vi.spyOn(obj, 'method')` para espiar metodos existentes
- `vi.mock('module')` para mockear modulos completos
- NUNCA usar jasmine.createSpy() ni jasmine.createSpyObj()
```

#### 1.7: Actualizar hooks

**Archivo:** `templates/.claude/hooks/pre-write-guard.js`

Si hay context injection que mencione Karma o Jasmine, actualizar a Vitest.

#### 1.8: Validacion

| Check | Criterio de exito |
|-------|-------------------|
| `ng test --watch=false` en proyecto generado | Todos los specs pasan con Vitest |
| `npm run test:coverage` | Reporte de cobertura se genera |
| Specs usan `vi.fn()`, no `jasmine.createSpy()` | grep confirma 0 referencias a Jasmine |
| `angular.json` usa builder vitest | No hay referencia a karma |

---

## C-2: GSAP como Opt-in (no obligatorio)

### Contexto

La industria usa **View Transitions API + CSS animations** como default para animaciones web. GSAP es una libreria premium que agrega peso (~30kb) y curva de aprendizaje. Ningun estandar de la industria lo marca como obligatorio.

La decision actual de KOA de PROHIBIR `@keyframes` en componentes y OBLIGAR GSAP para toda animacion es mas restrictiva que cualquier guia enterprise encontrada.

**Fuentes**: MDN View Transitions API, Angular official (usa CSS animations en sus ejemplos)

### Alcance

#### 2.1: Nuevo flag --with-gsap (invertir el default)

**Archivo:** `bin/index.js`

```diff
- { name: 'noGsap', type: 'confirm', message: 'Skip GSAP?', default: false }
+ { name: 'withGsap', type: 'confirm', message: 'Include GSAP animations?', default: false }
```

**Logica:**
- `--with-gsap` → instala `gsap`, copia `GsapAnimationsService`, habilita reglas GSAP
- Sin flag → NO instala GSAP, animaciones via CSS + View Transitions API
- Mantener `--no-gsap` como alias de compatibilidad (equivale a no pasar `--with-gsap`)

**blueprint.json:**
```diff
- "gsap": true  (default)
+ "gsap": false  (default, true solo si --with-gsap)
```

#### 2.2: Animaciones CSS como fallback default

**Archivo nuevo:** `templates/boilerplate/src/styles/_animations.scss`

Proveer animaciones base SIN GSAP para proyectos que no lo usen:

```scss
// Entrada de componentes — alternativa ligera a GSAP
@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

// Utility classes para entrada
.animate-fade-in-up {
  animation: fade-in-up 0.4s ease-out both;
}

.animate-fade-in {
  animation: fade-in 0.3s ease-out both;
}

// Stagger helper (CSS-only)
.animate-stagger > * {
  animation: fade-in-up 0.4s ease-out both;
  @for $i from 1 through 12 {
    &:nth-child(#{$i}) { animation-delay: #{$i * 0.05}s; }
  }
}

// Respeta preferencia del usuario
@media (prefers-reduced-motion: reduce) {
  .animate-fade-in-up,
  .animate-fade-in,
  .animate-stagger > * {
    animation: none;
  }
}
```

#### 2.3: View Transitions API para navegacion

**Archivo:** `templates/boilerplate/src/app/app.config.ts` (seccion de router)

```typescript
provideRouter(routes, withViewTransitions())
```

**Archivo nuevo (solo si NO --with-gsap):** `templates/boilerplate/src/styles/_view-transitions.scss`

```scss
// Transiciones de ruta nativas (View Transitions API)
::view-transition-old(root) {
  animation: fade-out 0.2s ease-in;
}

::view-transition-new(root) {
  animation: fade-in 0.3s ease-out;
}

@keyframes fade-out {
  to { opacity: 0; }
}
```

#### 2.4: Actualizar reglas y hooks

**Archivo:** `templates/.claude/rules/visual-system.md`

```diff
- ## Animaciones (GSAP obligatorio)
- - **PROHIBIDO** `@angular/animations` ni CSS `@keyframes` para entradas de vistas
- - **OBLIGATORIO** `GsapAnimationsService` en `ngAfterViewInit`
+ ## Animaciones
+ - **PROHIBIDO** `@angular/animations` (redundante con CSS nativo y GSAP)
+ - **DEFAULT (sin GSAP)**: CSS `@keyframes` + View Transitions API
+   - Usar clases `.animate-fade-in-up`, `.animate-stagger` de `_animations.scss`
+   - Navegacion: `withViewTransitions()` en router config
+ - **CON GSAP (`blueprint.gsap: true`)**: `GsapAnimationsService` en `ngAfterViewInit`
+   - `@keyframes` SOLO en `src/styles/` (design system global), prohibido en componentes
+   - Metodos: `animateBentoGrid()`, `animateHero()`, `animateCounter()`, `addCardHover()`
+ - **SIEMPRE**: respetar `prefers-reduced-motion`
```

**Archivo:** `templates/.claude/hooks/pre-write-guard.js`

Condicionar la regla de `@keyframes` a `blueprint.gsap === true`:
```javascript
// Solo bloquear @keyframes en componentes SI el proyecto usa GSAP
if (blueprint.gsap && filePath.includes('src/app/') && content.includes('@keyframes')) {
  // ... bloquear
}
// Si NO usa GSAP, @keyframes son validos en cualquier parte
```

#### 2.5: Condicionalidad en scaffold

**Archivo:** `bin/index.js`

Si `--with-gsap`:
- Instalar `gsap` como dependency
- Copiar `GsapAnimationsService`
- Copiar directivas GSAP (`appCardHover`, `appAnimateIn`, etc.)
- Habilitar reglas GSAP en architect.js

Si NO `--with-gsap` (default):
- Copiar `_animations.scss` y `_view-transitions.scss`
- NO instalar gsap
- Architect.js skipea validaciones GSAP
- Context injection menciona clases CSS en vez de GsapAnimationsService

#### 2.6: Validacion

| Check | Criterio de exito |
|-------|-------------------|
| Proyecto sin `--with-gsap` | Compila, `ng serve` funciona, animaciones CSS visibles |
| Proyecto con `--with-gsap` | Compila, GSAP funcional, reglas GSAP activas |
| `npm run lint:arch` sin GSAP | 0 errores relacionados a GSAP/keyframes |
| `npm run lint:arch` con GSAP | Bloquea @keyframes en componentes |
| `prefers-reduced-motion` | Animaciones desactivadas en ambos modos |

---

## C-3: NgRx Signal Store como Opcion

### Contexto

El consenso de la industria (Nx Blog 2025, NgRx oficial) es un enfoque tiered:

| Complejidad | Herramienta | KOA actual |
|-------------|-------------|------------|
| Simple (UI local) | `signal()` | Cubierto |
| Medio (feature state) | `signalState()` | **NO cubierto** |
| Enterprise (cross-feature) | `signalStore()` | **NO cubierto** |
| Legacy | Classic NgRx Store | No aplica (proyecto nuevo) |

Los Facades raw con signals cubren el 80% de los casos, pero equipos con 10+ features y estado compartido complejo eventualmente necesitan Signal Store.

**Fuente**: [nx.dev/blog/angular-state-management-2025](https://nx.dev/blog/angular-state-management-2025)

### Alcance

#### 3.1: Nuevo flag --with-ngrx-signals

**Archivo:** `bin/index.js`

```javascript
{
  name: 'withNgrxSignals',
  type: 'confirm',
  message: 'Include NgRx Signal Store for structured state management?',
  default: false
}
```

**Dependencias condicionales:**
```javascript
if (options.withNgrxSignals) {
  devDeps.push('@ngrx/signals');
}
```

**blueprint.json:**
```json
{ "ngrxSignals": true }
```

#### 3.2: Ejemplo de Signal Store

**Archivo nuevo:** `templates/boilerplate-ngrx/src/app/core/state/example.store.ts`

```typescript
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { computed, inject } from '@angular/core';
import { SupabaseService } from '../services/supabase.service';

// Estado tipado
interface ExampleState {
  items: Item[];
  isLoading: boolean;
  error: string | null;
  filter: string;
}

// Estado inicial
const initialState: ExampleState = {
  items: [],
  isLoading: false,
  error: null,
  filter: ''
};

// Store funcional (reemplaza Facade para estado complejo)
export const ExampleStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    filteredItems: computed(() =>
      store.items().filter(item =>
        item.name.toLowerCase().includes(store.filter().toLowerCase())
      )
    ),
    itemCount: computed(() => store.items().length)
  })),
  withMethods((store, supabase = inject(SupabaseService)) => ({
    async loadItems(): Promise<void> {
      patchState(store, { isLoading: true, error: null });
      try {
        const { data, error } = await supabase.client
          .from('items')
          .select('*');
        if (error) throw error;
        patchState(store, { items: data ?? [], isLoading: false });
      } catch (err) {
        patchState(store, { error: String(err), isLoading: false });
      }
    },
    setFilter(filter: string): void {
      patchState(store, { filter });
    }
  }))
);
```

#### 3.3: Guia de decision: Facade vs Signal Store

**Archivo nuevo:** `templates/.claude/rules/state-management.md`

```markdown
# State Management — Cuando usar que

## Facade (default — siempre disponible)
Usar cuando:
- El estado pertenece a UN solo dominio/feature
- Maximo 3-4 signals por facade
- No hay estado compartido entre features
- La logica es CRUD simple

## Signal Store (requiere --with-ngrx-signals)
Usar cuando:
- Estado compartido entre 2+ features
- Mas de 5 signals con derived state complejo
- Necesitas `patchState()` para updates parciales atomicos
- Multiples computed() que dependen del mismo estado
- El feature tiene mas de 3 actions/methods

## Regla de escalamiento
1. Empieza con Facade
2. Si el Facade crece a >5 inject() o >8 signals → migra a Signal Store
3. NUNCA mezclar Facade + Signal Store para el MISMO dominio
```

#### 3.4: Actualizar architect.js

**Archivo:** `templates/boilerplate/scripts/architect.js`

Si `blueprint.ngrxSignals === true`:
- Validar que Signal Stores vivan en `core/state/` (no en features/ ni shared/)
- Warning si un Facade tiene >8 signals → sugerir migracion a Signal Store
- Validar que componentes NO inyecten Signal Store directamente — pasar por Facade o inyectar el Store como readonly

Si `blueprint.ngrxSignals === false`:
- Ignorar reglas de Signal Store
- No mostrar warnings de migracion

#### 3.5: Actualizar indices

**Archivo nuevo en template:** `templates/indices/STORES.md` (solo si --with-ngrx-signals)

```markdown
# Signal Stores

| Store | Dominio | Signals | Computed | Metodos | Estado |
|-------|---------|---------|----------|---------|--------|
| `ExampleStore` | Example | 4 | 2 | 2 | Ejemplo |
```

#### 3.6: Actualizar skill angular-signals

**Archivo:** `templates/.claude/skills/angular-signals.md`

Agregar seccion condicional:
```markdown
## Signal Store (si blueprint.ngrxSignals: true)
- Definir stores en `core/state/{domain}.store.ts`
- Usar `signalStore()` + `withState()` + `withComputed()` + `withMethods()`
- `patchState()` para updates parciales (inmutable por default)
- Inyectar en Smart Components: `store = inject(ExampleStore)`
- NUNCA exponer `patchState` al template — solo metodos del store
```

#### 3.7: Validacion

| Check | Criterio de exito |
|-------|-------------------|
| Proyecto con `--with-ngrx-signals` | `@ngrx/signals` instalado, ExampleStore compila |
| Proyecto sin flag | Sin `@ngrx/signals`, sin archivos de store |
| `lint:arch` con flag | Valida ubicacion de stores en `core/state/` |
| `lint:arch` sin flag | Ignora reglas de Signal Store |

---

## C-4: Agregar AGENTS.md Portable

### Contexto

`CLAUDE.md` es especifico de Claude Code. Otros tools AI (Cursor, Copilot, Codex, Windsurf) leen `AGENTS.md` o `.cursorrules`. Un proyecto generado deberia ser compatible con cualquier AI coding tool.

**Fuente**: [arxiv.org/html/2602.20478v1](https://arxiv.org/html/2602.20478v1) — "Codified Context: Infrastructure for AI Agents"

### Alcance

#### 4.1: Template AGENTS.md

**Archivo nuevo:** `templates/AGENTS.md`

Contenido: subset portable de las reglas de `CLAUDE.md` sin dependencia de features de Claude Code (hooks, skills, etc.):

```markdown
# Project Architecture — AI Agent Guidelines

> This file provides architecture context for AI coding assistants.
> For Claude Code specific features (hooks, skills), see `.claude/CLAUDE.md`.

## Tech Stack
- Angular 20+ (standalone components, signal-based reactivity)
- PrimeNG (UI component library)
- Supabase (BaaS: PostgreSQL + Auth + Realtime)
- Tailwind CSS v4 (utility-first, semantic tokens only)

## Architecture Rules

### Folder Structure
- `core/` — Facades, Services, Guards, Models, Utils (infrastructure)
- `features/` — Smart Components (pages, inject Facades)
- `shared/` — Dumb Components (presentational, input()/output() only)
- `layout/` — App shell, sidebar, topbar

### Component Patterns
- ALL components use `ChangeDetectionStrategy.OnPush`
- Smart components (features/) inject Facades, coordinate Dumb components
- Dumb components (shared/) have ONLY `input()` and `output()` — no service injection
- Use `@if`, `@for` control flow (NOT `*ngIf`, `*ngFor`)
- Use `input()`, `output()` signal API (NOT `@Input()`, `@Output()`)

### State Management
- `signal()` for synchronous UI state
- `RxJS` for async flows in Services
- `toSignal()` to expose RxJS to templates via Facades
- `computed()` for derived state
- Components NEVER inject SupabaseService directly — always through Facades

### Styling
- NEVER use arbitrary Tailwind colors (text-red-500, bg-[#hex])
- ALWAYS use semantic tokens: `text-primary`, `text-muted`, `bg-surface`, `bg-base`
- Brand color: `var(--ds-brand)`, `var(--color-primary)`
- Layout: Bento Grid system (`.bento-grid`, `.bento-wide`, `.bento-tall`)

### Database
- Migrations in `supabase/migrations/` — idempotent SQL
- RLS (Row Level Security) REQUIRED on every table
- Never modify database manually — always via migrations

### Testing
- Co-located `.spec.ts` files next to source
- Facades and Services: mandatory tests
- Utils: mandatory tests (pure functions)
- Dumb components with computed(): mandatory tests

## Index Files
Check `indices/` directory for existing components, services, facades, and models
before creating new ones. Reuse first, create second.
```

#### 4.2: Agregar .cursorrules como symlink

**Archivo:** `bin/index.js`

Despues de copiar `AGENTS.md`, crear `.cursorrules` como copia (no symlink, para compatibilidad Windows):

```javascript
fs.copyFileSync(
  path.join(targetDir, 'AGENTS.md'),
  path.join(targetDir, '.cursorrules')
);
```

#### 4.3: Actualizar CLAUDE.md para referenciar AGENTS.md

**Archivo:** `templates/CLAUDE.md`

Agregar al inicio:
```diff
+ > Para AI tools distintos a Claude Code, ver `AGENTS.md` (reglas portables).
+ > `AGENTS.md` es un subset de este archivo sin dependencias de Claude Code.
```

#### 4.4: Validacion

| Check | Criterio de exito |
|-------|-------------------|
| Proyecto generado tiene `AGENTS.md` | Archivo presente en raiz |
| Proyecto generado tiene `.cursorrules` | Copia identica a AGENTS.md |
| Contenido de AGENTS.md | No referencia hooks, skills, ni features de Claude Code |
| AGENTS.md cubre reglas criticas | Folder structure, OnPush, Facade pattern, tokens, RLS |

---

## C-5: E2E Testing Setup

### Contexto

La piramide de testing moderna: Unit (Vitest) → Integration (TestBed) → E2E (Playwright/Cypress). KOA genera setup para los primeros dos tiers pero no para E2E.

**Eleccion: Playwright** sobre Cypress. Razones:
- Cross-browser nativo (Chromium, Firefox, WebKit)
- Mas rapido en CI (no requiere browser UI)
- Soporte oficial de Microsoft, crecimiento mas rapido en 2025-2026
- Mejor para proyectos nuevos (Cypress tiene legacy baggage)

### Alcance

#### 5.1: Nuevo flag --with-e2e

**Archivo:** `bin/index.js`

```javascript
{
  name: 'withE2e',
  type: 'confirm',
  message: 'Include Playwright for E2E testing?',
  default: false
}
```

**Dependencias condicionales:**
```javascript
if (options.withE2e) {
  devDeps.push('@playwright/test');
}
```

**blueprint.json:**
```json
{ "e2e": true }
```

#### 5.2: Configuracion de Playwright

**Archivo nuevo:** `templates/boilerplate-e2e/playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['list']
  ],
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    }
  ],
  webServer: {
    command: 'ng serve',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000
  }
});
```

#### 5.3: Smoke test de ejemplo

**Archivo nuevo:** `templates/boilerplate-e2e/e2e/app.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('App Shell', () => {
  test('should load the application', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/./);  // Tiene algun titulo
  });

  test('should render the main layout', async ({ page }) => {
    await page.goto('/');
    // Verifica que el shell de la app renderiza
    const app = page.locator('app-root');
    await expect(app).toBeVisible();
  });

  test('should respect reduced motion preference', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    // La app debe cargar sin errores en modo reduced motion
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.waitForLoadState('networkidle');
    expect(errors).toHaveLength(0);
  });
});
```

#### 5.4: Scripts de package.json

```json
{
  "e2e": "playwright test",
  "e2e:ui": "playwright test --ui",
  "e2e:headed": "playwright test --headed",
  "e2e:report": "playwright show-report"
}
```

#### 5.5: CI helpers

**Archivo nuevo:** `templates/boilerplate-e2e/e2e/README.md`

```markdown
# E2E Testing con Playwright

## Setup inicial (una vez)
npx playwright install

## Comandos
- `npm run e2e` — Ejecutar todos los tests headless
- `npm run e2e:ui` — Abrir UI interactiva de Playwright
- `npm run e2e:headed` — Ejecutar con browser visible
- `npm run e2e:report` — Ver reporte HTML del ultimo run

## Escribir tests
- Archivos en `e2e/` con extension `.spec.ts`
- Usar `page.locator()` con selectores semanticos (data-testid, roles ARIA)
- Patron: Arrange (goto) → Act (click, fill) → Assert (expect)
```

#### 5.6: Actualizar .gitignore

Agregar al .gitignore del boilerplate:
```
# Playwright
/test-results/
/playwright-report/
/blob-report/
/playwright/.cache/
```

#### 5.7: Opcional — data-testid helper

**Archivo:** `templates/.claude/rules/testing-tdd.md`

Agregar seccion:
```markdown
## E2E Testing (si blueprint.e2e: true)
- Archivos E2E en `e2e/` (raiz del proyecto, no en src/)
- Runner: Playwright
- Selectores: preferir `data-testid` o roles ARIA sobre clases CSS
- Para componentes criticos, agregar `data-testid="nombre-descriptivo"` al elemento raiz
- Smart Components (features/) deben tener al menos 1 E2E smoke test
- NUNCA usar selectores fragiles (.class, nth-child) — preferir semanticos
```

#### 5.8: Validacion

| Check | Criterio de exito |
|-------|-------------------|
| Proyecto con `--with-e2e` | Playwright instalado, `playwright.config.ts` presente |
| Proyecto sin flag | Sin Playwright, sin directorio `e2e/` |
| `npm run e2e` (con ng serve) | Smoke test pasa en Chromium |
| `e2e/` en .gitignore | Reports y cache excluidos |

---

## Orden de Ejecucion

```
C-1 (Vitest)  ──────────> Afecta boilerplate base, debe ir primero
  │
C-2 (GSAP opt-in) ──────> Cambia defaults del generador
  │
C-4 (AGENTS.md) ────────> Independiente, rapido (0.5 sesion)
  │                        Puede ejecutarse en paralelo con C-2
C-3 (NgRx Signals) ─────> Agrega flag y archivos opcionales
  │
C-5 (E2E Playwright) ───> Agrega flag y archivos opcionales
  │
VALIDACION FINAL ────────> Generar proyecto con TODAS las combinaciones
```

### Matriz de compatibilidad de flags (actualizada)

| Flag A | Flag B | Resultado |
|--------|--------|-----------|
| `--with-gsap` | `--with-ngrx-signals` | OK — independientes |
| `--with-gsap` | `--with-e2e` | OK — independientes |
| `--with-ngrx-signals` | `--with-e2e` | OK — independientes |
| `--with-e2e` | `--no-supabase` | OK — E2E no depende de Supabase |
| `--with-ngrx-signals` | `--no-supabase` | OK — Signal Store es frontend-only |
| Todos los --with-* juntos | — | OK — deben ser compatibles |

### Validacion final (gate antes de release)

| Combinacion | Debe compilar | lint:arch pasa | Tests pasan |
|-------------|--------------|----------------|-------------|
| Default (sin flags) | Si | Si | Si (Vitest) |
| `--with-gsap` | Si | Si | Si |
| `--with-ngrx-signals` | Si | Si | Si |
| `--with-e2e` | Si | Si | Si (unit + e2e) |
| `--with-gsap --with-ngrx-signals --with-e2e` | Si | Si | Si |
| `--no-supabase --with-e2e` | Si | Si | Si |
| `--no-primeng` | Si | Si | Si |

---

## Impacto en el Roadmap v7.0

Estas correcciones son **independientes** del roadmap v7.0 (docs/tareas.md). Se pueden aplicar como **v6.1** o **v6.2** antes de iniciar v7.

**Recomendacion:** Ejecutar C-1 a C-5, tagear como **v6.2**, y luego continuar con v7.0 Fase 0.

### Archivos del CLI modificados (resumen)

| Archivo | Correcciones que lo tocan |
|---------|--------------------------|
| `bin/index.js` | C-1, C-2, C-3, C-4, C-5 |
| `templates/.claude/rules/visual-system.md` | C-2 |
| `templates/.claude/rules/testing-tdd.md` | C-1, C-5 |
| `templates/.claude/hooks/pre-write-guard.js` | C-1, C-2 |
| `templates/boilerplate/angular.json` | C-1 |
| `templates/boilerplate/package.json` | C-1, C-5 |
| `templates/CLAUDE.md` | C-4 |
| `templates/AGENTS.md` | C-4 (nuevo) |
| `templates/boilerplate/vitest.config.ts` | C-1 (nuevo) |
| `templates/boilerplate/src/styles/_animations.scss` | C-2 (nuevo) |
| `templates/boilerplate-ngrx/` | C-3 (nuevo directorio) |
| `templates/boilerplate-e2e/` | C-5 (nuevo directorio) |
| `templates/.claude/rules/state-management.md` | C-3 (nuevo) |
