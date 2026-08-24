# Koa Agent CLI — Documento Técnico Completo

> **Versión del documento:** 1.0
> **Fecha:** 2026-03-23
> **Autor del sistema:** Benjamín Rebolledo
> **Versión actual del producto:** Blueprint v6.0.0 (v7.0 en planificación)

---

## 1. RESUMEN EJECUTIVO

### ¿Qué es Koa Agent CLI?

**Koa Agent CLI** (`create-koa-agent`) es un motor de scaffolding construido en Node.js que genera ecosistemas de trabajo Angular optimizados para ser operados por **agentes de inteligencia artificial** (Claude Code, Claude 3.7 Sonnet, etc.). A diferencia de un generador de boilerplate tradicional, Koa inyecta una **arquitectura estricta "Harness"** que domina la ventana de contexto de la IA, transformando al agente de un asistente que "improvisa" a un teclado ultra-rápido operando bajo un sistema de constraints que previene la deriva arquitectónica.

El sistema tiene dos capas fundamentales: una **capa CLI** (el programa Node.js que ejecutas) y una **capa Blueprint** (el conjunto de plantillas, guardrails, reglas y memoria que se inyectan en el proyecto destino). Juntas, estas capas garantizan que el código generado por IA mantenga calidad enterprise sin intervención humana constante.

### Problema que resuelve

En la era del software AI-Native, el cuello de botella ya no es la generación de código, sino la **orquestación**. Cuando un agente IA avanzado opera sobre un repositorio sin constraints, el resultado típico es código espagueti, deuda técnica acelerada y drift arquitectónico. El humano termina gastando más tiempo corrigiendo al agente que programando él mismo.

Koa resuelve esto inyectando **guardrails automáticos** que:
- Bloquean en tiempo real al agente si intenta violar una regla de diseño
- Inyectan contexto relevante dinámicamente según el tipo de archivo editado
- Mantienen una "memoria viva" del proyecto que previene duplicación y drift
- Validan la arquitectura completa via AST (Abstract Syntax Tree) como auditoría post-hoc

### Value Proposition Única

> *"Convierte las reglas arquitectónicas de un contrato social (que la IA puede ignorar) a constraints del sistema (que la IA no puede violar)."*

Mientras otros sistemas dependen de que el desarrollador "recuerde" decirle al agente las reglas en cada prompt, Koa ejecuta hooks automáticos que bloquean, validan e inyectan contexto sin intervención humana.

### Para quién es

- **Desarrolladores Angular** que usan agentes IA para acelerar su desarrollo
- **Equipos pequeños** que necesitan mantener calidad enterprise sin un equipo de QA dedicado
- **Consultoras** que quieren replicar su arquitectura estándar en múltiples proyectos
- **Solo-founders** que operan como "Arquitecto Agéntico" — piensan profundo, el agente implementa rápido

---

## 2. DESCRIPCIÓN TÉCNICA COMPLETA

### 2.1 Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────┐
│                    KOA AGENT CLI                         │
│                 (create-koa-agent)                        │
│                                                          │
│  ┌──────────────┐    ┌───────────────────────────────┐   │
│  │  CAPA A:     │    │  CAPA B:                      │   │
│  │  CLI          │    │  BLUEPRINT (templates/)       │   │
│  │  (bin/index.js│    │                               │   │
│  │  )            │───>│  .claude/                     │   │
│  │              │    │  ├── CLAUDE.md (directiva)     │   │
│  │  - inquirer  │    │  ├── hooks/ (guardrails)       │   │
│  │  - chalk     │    │  ├── rules/ (9 reglas)         │   │
│  │  - ora       │    │  ├── skills/ (7 skills)        │   │
│  │  - spawn     │    │  └── settings.json             │   │
│  │              │    │                               │   │
│  │              │    │  docs/ (guías humanas)         │   │
│  │              │    │  indices/ (memoria viva)       │   │
│  │              │    │  scripts/ (linter AST)         │   │
│  │              │    │  .mcp.json (MCP servers)       │   │
│  │              │    │                               │   │
│  │              │    │  boilerplate/ (Full Scaffold)   │   │
│  │              │    │  └── src/ (app Angular)        │   │
│  └──────────────┘    └───────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              PROYECTO GENERADO                           │
│                                                          │
│  src/app/                                                │
│  ├── core/      (Facades, Guards, Models, Utils)         │
│  ├── features/  (Smart Components — páginas)             │
│  ├── shared/    (Dumb Components — UI presentacional)    │
│  └── layout/    (Shell, Sidebar, Topbar)                 │
│                                                          │
│  .claude/hooks/  ← GUARDRAILS ACTIVOS                    │
│  .claude/rules/  ← REGLAS INYECTADAS                     │
│  scripts/architect.js ← LINTER AST                       │
│  indices/*.md    ← MEMORIA VIVA                          │
│  blueprint.json  ← TRAZABILIDAD DE VERSIÓN               │
└─────────────────────────────────────────────────────────┘
```

#### Flujo de ejecución completo

```
Usuario ejecuta: create-koa-agent
    │
    ├─ 1. preflight() — Valida Node.js ≥20, npm, npx, git (warn), docker (warn)
    │
    ├─ 2. parseCliFlags() — Lee --no-supabase, --no-gsap, --no-primeng
    │
    ├─ 3. readKoaConfig() — Merge con koa-config.json (si existe)
    │
    ├─ 4. printBanner() — ASCII art con versión del Blueprint
    │
    ├─ 5. inquirer.prompt() — ¿Full Scaffold o Solo Memoria?
    │
    ├─ 6a. [Full Scaffold]
    │   ├─ validateProjectName() — regex, 214 chars, Windows reserved
    │   ├─ Crear directorio temporal (.koa-tmp-*)
    │   ├─ npx @angular/cli@latest new ... (standalone, routing, scss)
    │   ├─ npm install (tailwindcss, primeng, gsap, supabase-js, lucide)
    │   ├─ npx supabase init (si supabase habilitado)
    │   ├─ Copiar templates/ (excepto boilerplate/) → proyecto
    │   ├─ Copiar boilerplate/src/ → src/
    │   ├─ Copiar boilerplate/scripts/ → scripts/
    │   ├─ Copiar postcss.config.json
    │   ├─ Parchear tsconfig.json (path aliases @core/*, @shared/*, etc.)
    │   ├─ Parchear angular.json (tailwind.css + inlineCritical: false)
    │   ├─ Parchear index.html (Google Fonts preconnect)
    │   ├─ Parchear app.config.ts (PrimeNG provider + Aura theme)
    │   ├─ Inyectar scripts npm (claude:*, lint:arch, indices:sync)
    │   ├─ Renombrar directorio temporal → nombre final
    │   └─ Escribir blueprint.json (trazabilidad)
    │
    ├─ 6b. [Solo Memoria]
    │   ├─ Copiar templates/ (excepto boilerplate/) → carpeta actual
    │   └─ Sustituir {{PROJECT_NAME}} y {{BLUEPRINT_VERSION}}
    │
    └─ 7. printSuccess() — Próximos pasos para el usuario
```

### 2.2 Características Técnicas Detalladas

#### Funcionalidad de instalación

**Requisitos del sistema:**
- Node.js v20.0.0 o superior
- npm (viene con Node)
- Git (recomendado, no obligatorio)
- Docker (opcional, para contenedores Supabase)

**Plataformas soportadas:**
- Windows 10/11 (con `.cmd` suffix para npm/npx)
- macOS
- Linux

**Instalación:**
```bash
git clone https://github.com/tu-usuario/koa-agent-cli.git
cd koa-agent-cli
npm install
npm link
```

**Uso:**
```bash
# Full Scaffold
create-koa-agent

# Con flags opcionales
create-koa-agent --no-supabase --no-gsap

# Archivo de configuración alternativo
# Crear koa-config.json en el directorio actual:
# { "stack": { "supabase": false, "gsap": false } }
```

**Dos modos de operación:**

| Modo | Qué hace | Cuándo usarlo |
|------|----------|---------------|
| **Full Scaffold** | Crea proyecto Angular nuevo + instala dependencias + inyecta Blueprint completo + boilerplate | Proyecto nuevo desde cero |
| **Solo Memoria** | Inyecta `.claude/`, `docs/`, `indices/`, `.mcp.json` en carpeta actual | Convertir proyecto existente en AI-Native |

---

#### Sistema de Hooks (Guardrails Automáticos)

Los hooks son el corazón de Koa. Convierten las reglas escritas en CLAUDE.md en **constraints ejecutables** que Claude Code no puede ignorar.

**¿Cómo funcionan?**
Claude Code tiene un sistema de hooks que ejecuta scripts JavaScript en eventos específicos (antes/después de usar herramientas, al compactar contexto, al terminar respuestas). Koa aprovecha este sistema para inyectar 6 hooks:

##### Hook 1: Pre-Write Guard (`pre-write-guard.js`)
- **Evento:** PreToolUse → Edit/Write/MultiEdit
- **Mecanismo:** 4 capas de validación antes de cada escritura

| Capa | Función | Si falla |
|------|---------|----------|
| **File Protection** | Bloquea edits a `.claude/hooks/`, `settings.json`, `architect.js` | `BLOQUEADO: archivo protegido` |
| **Discovery Gate** | Verifica que se leyeron los índices antes de escribir código | `BLOQUEADO: lee indices/ primero` |
| **Architect Guard** | Valida 11+ reglas en el contenido nuevo | `BLOQUEADO: violación específica` |
| **Context Injection** | Inyecta rules y skills relevantes según tipo de archivo | Contexto adicional para Claude |

**Reglas validadas por el Architect Guard:**

| Regla | Archivos afectados | Qué detecta |
|-------|--------------------|-------------|
| No `*ngIf` / `*ngFor` | .ts, .html | Directivas deprecadas de Angular |
| No `[ngClass]` / `[ngStyle]` | .ts, .html | Bindings deprecados |
| No `@Input()` / `@Output()` | .ts | Decoradores legacy (usar signal API) |
| No `@supabase/supabase-js` en UI | .ts (features/shared) | Import directo en capa de presentación |
| No `@angular/animations` | .ts | Usar GSAP en vez de animations |
| OnPush obligatorio | .component.ts | Solo en Write (archivo completo) |
| No colores hardcodeados | .ts, .html, .scss | `text-red-500`, `bg-blue-200`, etc. |
| No `@keyframes` en componentes | .scss, .css (src/app/) | Usar GSAP (permitido en src/styles/) |
| No Facade en Dumb comp. | shared/*.component.ts | Dumb components no inyectan Facades |
| Naming de migraciones | supabase/migrations/ | Formato: YYYYMMDDHHMMSS_dominio_tipo_desc.sql |
| RLS obligatorio | .sql con CREATE TABLE | Toda tabla nueva debe tener RLS activado |

**Context Injection — Reglas inyectadas según tipo de archivo:**

| Archivo editado | Rules inyectadas | Skills referenciadas |
|-----------------|-----------------|---------------------|
| `features/*.component.ts` | architecture.md, visual-system.md | angular-component, design-system, angular-signals |
| `shared/*.component.ts` | architecture.md (Dumb), visual-system.md | angular-component, design-system |
| `core/facades/*.facade.ts` | architecture.md (Facade pattern) | angular-signals |
| `supabase/migrations/*.sql` | database.md | supabase-data-model |
| `*.html` (templates) | architecture.md, visual-system.md, ai-readability.md | angular-primeng |
| `*.scss` / `*.css` | visual-system.md | design-system |

##### Hook 2: Discovery Tracker (`discovery-tracker.js`)
- **Evento:** PostToolUse → Read
- **Función:** Cuando Claude lee un archivo de `indices/`, crea un flag temporal que desbloquea el Discovery Gate para el resto de la sesión

##### Hook 3: Bash Guard (`bash-guard.js`)
- **Evento:** PreToolUse → Bash
- **Función:** Bloquea:
  - Creación de archivos `.ts/.html/.scss/.sql` via Bash (debe usar Edit/Write)
  - Operaciones destructivas (`rm -rf`) sobre directorios críticos

##### Hook 4: Compact Recovery (`compact-recovery.js`)
- **Evento:** SessionStart (compact)
- **Función:** Cuando Claude Code compacta la conversación, re-inyecta el contenido de todos los `indices/*.md`. Claude nunca pierde la memoria de lo que existe en el proyecto

##### Hook 5: Sync Check (prompt hook)
- **Evento:** Stop (cada respuesta)
- **Tipo:** prompt (evaluado por modelo Haiku)
- **Función:** Verifica si se crearon componentes/servicios sin actualizar los índices. Si detecta drift, fuerza a Claude a continuar

##### Hook 6: Prettier (`post-edit.js`)
- **Evento:** PostToolUse → Edit/Write/MultiEdit
- **Función:** Formatea automáticamente con Prettier cada archivo editado

---

#### Sistema de Guardrails (Defensa en Profundidad)

Koa implementa **dos niveles** de validación que se complementan:

| | Pre-Write Guard (Hook) | architect.js (Linter) |
|---|---|---|
| **Cuándo corre** | En cada Edit/Write individual | Bajo demanda (`npm run lint:arch`) |
| **Qué analiza** | Solo el contenido nuevo (diff) | Todo el proyecto completo |
| **Profundidad** | Regex rápido | AST completo de TypeScript |
| **Puede bloquear** | Sí (exit 2, en tiempo real) | Sí (exit 1, post-hoc) |
| **Detecta OnPush faltante** | Solo en Write (archivo nuevo) | Siempre (recorre todos los .component.ts) |

**Diferencia vs linters tradicionales:**
ESLint valida sintaxis y estilo. `architect.js` valida **arquitectura**: patrones de diseño, separación de capas, acoplamiento, TDD compliance. Es un **Shadow CI** que funciona como auditoría del diseño del sistema, no solo del código.

**Reglas del Linter AST (`architect.js`):**

| ID | Regla | Método | Severidad |
|----|-------|--------|-----------|
| ARCH-01 | No Supabase in UI | AST (import declaration) | Error |
| ARCH-02 | Facade-only injection en componentes vista | AST (call expression) | Error |
| ARCH-03 | TDD required — .spec.ts para facades/services en core/ | File existence check | Error |
| ARCH-04 | OnPush en todos los componentes | AST (decorator) + text search | Error |
| ARCH-05 | No `@angular/animations` | AST (import declaration) | Error |
| ARCH-06 | No `*ngIf/*ngFor/[ngClass]/[ngStyle]` | Regex en .html | Error |
| ARCH-07 | No `@keyframes` en SCSS de app/ | Regex en .scss/.css | Error |
| ARCH-08 | No colores Tailwind hardcodeados | Regex en .ts/.html | Error |
| ARCH-09 | Shared component >200 líneas | Line count | Warning |
| ARCH-10 | Facade con >5 inject o método >50 líneas | AST heuristics | Warning |

---

#### Memoria y Context Management

##### Sistema de Índices (`indices/`)

Los índices son la "memoria viva" del proyecto — la fuente de verdad que el agente consulta antes de crear algo nuevo:

| Índice | Propósito |
|--------|-----------|
| `COMPONENTS.md` | Todos los componentes Angular del proyecto |
| `SERVICES.md` | Servicios utilitarios (sin estado de dominio) |
| `FACADES.md` | Facades (con estado de dominio) |
| `MODELS.md` | Interfaces DTO y UI models |
| `DIRECTIVES.md` | Directivas personalizadas |
| `PIPES.md` | Pipes personalizados |
| `STYLES.md` | Clases CSS/SCSS del design system |
| `DATABASE.md` | Esquema de BD, tablas, RLS, funciones |
| `ANTI-PATTERNS.md` | Patrones a evitar (aprendidos de errores) |

**Auto-indexing:** El script `indices-sync.js` (ejecutable via `npm run indices:sync`) usa el TypeScript Compiler API para parsear el proyecto y regenerar automáticamente 4 índices (COMPONENTS, SERVICES, FACADES, MODELS) con marcadores `<!-- AUTO-GENERATED:BEGIN/END -->`.

##### CLAUDE.md y estructura de configuración

```
.claude/
├── CLAUDE.md              # Directiva maestra — el "contrato" del agente
│                           # Define: flujo de trabajo, reglas, referencias
├── hooks/
│   ├── pre-write-guard.js  # 4 capas de validación en tiempo real
│   ├── discovery-tracker.js # Flag cuando lee índices
│   ├── bash-guard.js       # Bloquea creación de archivos via bash
│   └── compact-recovery.js # Re-inyecta índices tras compactación
├── rules/                  # 9 documentos de reglas arquitectónicas
│   ├── architecture.md     # Facade pattern, Smart/Dumb, Signals
│   ├── models.md           # DTO vs UI models, nomenclatura
│   ├── facades.md          # Estructura interna obligatoria
│   ├── visual-system.md    # Tokens, Lucide, Bento Grid, KPI
│   ├── notifications.md    # 3 capas: Toast, Notification, Alert
│   ├── swr-pattern.md      # Stale-While-Revalidate + Realtime
│   ├── testing-tdd.md      # Agentic TDD obligatorio
│   ├── ai-readability.md   # data-llm-* attributes
│   └── database.md         # Migraciones SQL, RLS, naming
├── skills/                 # 7 skills para tareas comunes
│   ├── angular-component   # Crear/refactorizar componentes
│   ├── angular-forms       # Formularios reactivos/signal
│   ├── angular-primeng     # PrimeNG correctamente
│   ├── angular-signals     # Estado reactivo con Signals
│   ├── design-system       # Tokens, cards, bento, GSAP
│   ├── supabase-data-model # Tablas, migraciones, RLS
│   └── sync-indices        # Actualizar índices del proyecto
└── settings.json           # Configuración de hooks (eventos, matchers)
```

##### Progressive Disclosure

El sistema inyecta contexto **progresivamente** según lo que el agente está haciendo:

1. **Siempre visible:** CLAUDE.md (directiva maestra, ~200 líneas)
2. **Al leer índices:** Discovery Gate se desbloquea
3. **Al editar archivo:** Context Injection inyecta rules y skills relevantes
4. **Al compactar:** Compact Recovery re-inyecta índices
5. **Al terminar:** Sync Check verifica actualización de índices

---

#### Boilerplate Angular (Full Scaffold)

**Stack completo:**

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| Angular | 20+ (latest) | Framework frontend |
| Tailwind CSS | v4 | Utilidades CSS (layout, spacing) |
| PrimeNG | latest | Componentes complejos (tablas, calendarios) |
| GSAP | latest | Animaciones y microinteracciones |
| Supabase | latest | Base de datos, auth, realtime, storage |
| Lucide Angular | 0.577+ | Sistema de iconos (~58 iconos curados) |
| PostCSS | latest | Procesamiento CSS (requerido por Tailwind v4) |

**Estructura de carpetas canónica:**

```
src/
├── app/
│   ├── core/              # Facades, Guards, Interceptors, Modelos
│   │   ├── facades/       # *FacadeService (estado de dominio)
│   │   ├── services/      # Servicios utilitarios (sin estado)
│   │   ├── models/
│   │   │   ├── dto/       # Interfaces que mapean tablas de BD
│   │   │   └── ui/        # Interfaces para presentación
│   │   └── utils/         # Funciones puras (Functional Core)
│   ├── features/          # Smart Components (páginas enrutables)
│   ├── shared/            # Dumb Components (UI presentacional)
│   │   └── components/
│   │       ├── icon/      # <app-icon> wrapper sobre Lucide
│   │       ├── kpi-card/  # KPI card + skeleton colocated
│   │       └── skeleton-block/ # Bloque de skeleton genérico
│   └── layout/            # Shell, Sidebar, Topbar
├── styles/
│   ├── tokens/            # SCSS variables semánticas
│   │   └── _variables.scss # .kpi-value, .surface-hero, .indicator-live
│   └── vendors/           # PrimeNG overrides
│       └── _primeng-overrides.scss
├── tailwind.css           # @source + @utility btn-primary/secondary/ghost
└── index.html             # Google Fonts preconnect
supabase/
└── migrations/            # SQL idempotentes versionados
scripts/
├── architect.js           # Linter AST (10 reglas ARCH-*)
├── indices-sync.js        # Auto-indexer via TypeScript Compiler API
└── lint-arch-wrapper.js   # Wrapper con memoria de fallos → LESSONS_LEARNED.md
```

**Patrones obligatorios:**

1. **Facade Pattern:** UI → Facade → Supabase. La UI NUNCA accede a datos directamente
2. **Smart/Dumb (Atomic Design):**
   - Smart (`features/`): Inyectan Facades, coordinan Dumb components
   - Dumb (`shared/`): Solo `input()` y `output()`, sin Facades
3. **OnPush:** `ChangeDetectionStrategy.OnPush` en TODOS los componentes
4. **Signals + RxJS:** `signal()` para UI sync, RxJS para async, `toSignal()` para exponer
5. **Modern Templates:** `@if`, `@for` (prohibido `*ngIf`, `*ngFor`)
6. **Signal Inputs:** `input()`, `output()` (prohibido `@Input()`, `@Output()`)
7. **SWR Pattern:** Stale-While-Revalidate para evitar skeletons en re-visitas
8. **Agentic TDD:** Tests primero, implementación después, auto-validación obligatoria
9. **AI-Readability:** Atributos `data-llm-action`, `data-llm-description`, `data-llm-nav`
10. **Design Tokens:** Prohibido hardcodear colores Tailwind — usar tokens semánticos

**Configuraciones inyectadas automáticamente:**
- `tsconfig.json`: Path aliases (`@core/*`, `@shared/*`, `@features/*`, `@layout/*`)
- `angular.json`: tailwind.css en styles, `inlineCritical: false`
- `app.config.ts`: PrimeNG provider con Aura theme, CSS layers, dark mode selector
- `package.json`: Scripts `claude:review`, `claude:sync`, `claude:fix`, `claude:tdd`, `lint:arch`, `indices:sync`
- `postcss.config.json`: Configuración Tailwind v4 (DEBE ser .json, Angular ignora .js/.mjs)
- `index.html`: Google Fonts preconnect (Bricolage Grotesque)
- `blueprint.json`: Metadata de trazabilidad (versión, modo, stack, paths gestionados)

### 2.3 Especificaciones Técnicas

```
STACK DEL CLI:
- Node.js: ≥20.0.0
- Tipo de módulo: ESM ("type": "module")
- Dependencias CLI: inquirer ^13.3.0, chalk ^5.6.2, ora ^9.3.0
- Binario: create-koa-agent (via npm link)
- Blueprint version: 6.0.0

STACK DEL PROYECTO GENERADO:
- Angular: 20+ (latest via @angular/cli@latest)
- Tailwind CSS: v4
- PrimeNG: latest + @primeng/themes (Aura)
- GSAP: latest
- Supabase: @supabase/supabase-js latest
- Lucide Angular: latest (lucide-angular)
- PostCSS: latest + @tailwindcss/postcss
- Angular Animations: @angular/animations (async provider)
- Fuente: Bricolage Grotesque (Google Fonts)

ARCHIVOS CLAVE DEL CLI:
- bin/index.js: Punto de entrada del CLI (606 líneas, ESM)
- package.json: Metadata, bin entry, dependencias
- templates/: Fuente de verdad para todo lo que se inyecta
  - templates/.claude/: Hooks, rules, skills, settings
  - templates/boilerplate/: Código fuente Angular (solo Full Scaffold)
  - templates/docs/: Guías para humanos
  - templates/indices/: Plantillas de índices vacíos
  - templates/.mcp.json: Config MCP (ts-lsp, Angular CLI, Supabase)

COMANDOS:
- create-koa-agent: Ejecuta el CLI interactivo
- Flags: --no-supabase, --no-gsap, --no-primeng
- Config file: koa-config.json (alternativa a flags)
- Modos: "Full Scaffold" | "Solo inyectar Memoria"

SCRIPTS NPM INYECTADOS EN PROYECTO GENERADO:
- npm run claude:review  → Auditoría de arquitectura via Claude
- npm run claude:sync    → Sincroniza índices via Claude
- npm run claude:fix     → Auto-fix de errores de lint
- npm run claude:tdd     → TDD autónomo
- npm run lint:arch      → Linter AST completo (architect.js)
- npm run indices:sync   → Auto-indexer AST (indices-sync.js)
```

---

## 3. VALIDACIÓN Y PRUEBAS REALES

### 3.1 Estado Actual (v6.0.0)

**Funciona al 100%:**
- CLI interactivo con inquirer (Full Scaffold + Solo Memoria)
- Preflight checks (Node.js, npm, npx, git, docker)
- Validación de nombre de proyecto (regex, 214 chars, Windows reserved names)
- Scaffold en directorio temporal con rollback automático
- Inyección de Blueprint completo (hooks, rules, skills, docs, indices)
- Boilerplate Angular con PrimeNG, GSAP, Supabase, Tailwind v4, Lucide
- Parcheo de configuración (tsconfig, angular.json, app.config.ts, index.html, package.json)
- Flags condicionales (`--no-supabase`, `--no-gsap`, `--no-primeng`)
- `koa-config.json` para configuración via archivo
- `blueprint.json` para trazabilidad de versión
- Sistema de hooks completo (6 hooks activos)
- Linter AST con 10 reglas (8 errores + 2 warnings)
- Auto-indexer via TypeScript Compiler API
- Wrapper de linter con memoria de fallos → `LESSONS_LEARNED.md`
- `ANTI-PATTERNS.md` con 5 anti-patrones documentados

**En desarrollo (v7.0 planificado):**
- WI 7-02: Facades delgadas (ARCH-12/13 warnings adicionales)
- WI 7-03: Custom rules via archivos `.yml`
- WI 7-04: Pipeline automático LESSONS → ANTI-PATTERNS
- WI 7-05: RAG boilerplate (`--with-rag`): migración SQL pgvector, Edge Function, RagFacade
- WI 7-06: MCP Server scaffold (`--with-mcp-server`): schema introspection, safe query tool

**Diferido:**
- v7.1: `create-koa-agent update` (actualizar Blueprint en proyecto existente)
- v7.2: AI Streaming UI (`--with-ai-ui`)

**Bugs conocidos / Limitaciones:**
- `lucide-angular 0.577`: Usa `LucideAngularModule.pick()`, NO `provideIcons()` — diverge de la documentación oficial
- Angular 21: Directivas sin inputs deben usarse como atributos planos (`appCardHover`), NO como bindings (`[appCardHover]`)
- Tailwind v4 + Angular: `postcss.config` DEBE ser `.json` — Angular ignora `.js/.mjs/.cjs`
- Los hooks dependen de Claude Code CLI — en otros entornos solo funcionan las reglas + linter

**Plataformas testeadas:**
- Windows 10 Pro (plataforma principal de desarrollo)
- Proyectos generados validados con `ng build` y `ng serve`

### 3.2 Usuarios Actuales

**Uso documentado:**
- **Benjamín Rebolledo** (creador): Uso diario para desarrollo de proyectos Angular
- **App Familiar v2**: Proyecto real migrado desde MVP usando `create-koa-agent` Full Scaffold. 50+ tablas en Supabase, Angular 21, Blueprint v5.1. Fase 0 completada exitosamente
- **Proyecto Autoescuela**: Proyecto de referencia que originó las reglas y patrones del Blueprint. El boilerplate del CLI fue extraído de este proyecto real

**Resultados medibles:**
- Reducción de errores arquitectónicos por el agente (hooks bloquean en tiempo real)
- Consistencia entre proyectos (mismo Blueprint inyectado siempre)
- Los hooks eliminan la necesidad de "recordar reglas" al agente en cada prompt

### 3.3 Dependencias

| Dependencia | Obligatoria | Condicional | Propósito |
|-------------|-------------|-------------|-----------|
| Angular CLI | Sí | — | Crear proyecto base |
| Tailwind CSS v4 | Sí | — | Utilidades CSS |
| PostCSS | Sí | — | Procesamiento CSS |
| Lucide Angular | Sí | — | Sistema de iconos |
| **PrimeNG** | — | `--no-primeng` | Componentes complejos |
| **GSAP** | — | `--no-gsap` | Animaciones |
| **Supabase** | — | `--no-supabase` | Base de datos, auth, realtime |
| Node.js ≥20 | Sí | — | Runtime del CLI |
| npm | Sí | — | Gestión de paquetes |
| Claude Code CLI | Recomendado | — | Entorno que ejecuta los hooks |

**¿Es self-contained?**
Sí, en el sentido de que el CLI genera todo lo necesario. Pero requiere:
1. Node.js ≥20 instalado
2. Conexión a internet (para `npm install` y `ng new`)
3. Claude Code CLI para que los hooks funcionen (sin él, solo funcionan reglas + linter manual)
4. Supabase (local o cloud) si se usa la funcionalidad de BD

---

## 4. COMPARACIÓN CON ALTERNATIVAS

### 4.1 vs Competencia Directa

| Aspecto | Koa Agent CLI | Web Reactiva / Dani Primo | Society Eskailet |
|---------|---------------|--------------------------|------------------|
| **Tipo** | CLI + Blueprint (producto) | Skills system (contenido educativo) | Servicios de implementación (consultoría) |
| **Enfoque** | Guardrails automáticos para agentes IA | Educación y prompts para Claude | Implementación manual por humanos |
| **Enforcement** | Hooks + Linter AST (bloqueo automático) | Skills que el agente puede ignorar | Depende del consultor |
| **Stack** | Angular + Supabase + PrimeNG + GSAP | Multi-framework | Varía por proyecto |
| **Automatización** | Sí (hooks, context injection, auto-index) | No (manual) | No (manual) |
| **Replicabilidad** | Alta (un CLI, N proyectos) | Media (copiar skills) | Baja (cada proyecto es custom) |
| **Precio** | Open source (MIT) | Curso/comunidad de pago | Servicios profesionales |

### 4.2 Diferenciación

**Lo que Koa hace que otros NO hacen:**

1. **Enforcement automático via hooks:** Las reglas no son sugerencias — son constraints ejecutables que bloquean al agente en tiempo real. Ningún otro sistema público tiene este nivel de enforcement
2. **Context Injection dinámica:** Inyecta las reglas relevantes automáticamente según el tipo de archivo que el agente está editando, sin saturar el contexto completo
3. **Memoria viva con auto-indexing:** El sistema de índices se mantiene sincronizado automáticamente via AST parsing
4. **Defensa en profundidad:** Dos niveles (hooks en tiempo real + linter AST completo) que se complementan
5. **Scaffold completo end-to-end:** Desde `create-koa-agent` hasta `ng serve` en un solo comando
6. **Trazabilidad:** `blueprint.json` permite saber exactamente qué versión del Blueprint generó cada proyecto
7. **Flags condicionales:** Stack modular (`--no-supabase`, `--no-gsap`, `--no-primeng`)

**Ventajas técnicas únicas:**
- Único sistema que convierte reglas arquitectónicas en `process.exit(2)` (bloqueo real)
- Linter que valida patrones de diseño (Facade, Smart/Dumb) via AST, no solo estilo
- Recovery automático tras compactación de contexto (Compact Recovery hook)

**Limitaciones vs competencia:**
- Angular-only (vs multi-framework)
- Requiere Claude Code CLI para hooks (vs editor-agnostic)
- No publicado en NPM aún
- Stack opinionado (no flexible para equipos con preferencias diferentes)

---

## 5. POSICIONAMIENTO DE MERCADO

### 5.1 Target Market

**Segmentos específicos:**

1. **Desarrolladores Angular individuales** que usan Claude Code
   - Tamaño estimado: Miles de desarrolladores Angular a nivel global
   - Angular sigue siendo uno de los top 3 frameworks frontend enterprise

2. **Equipos pequeños (2-10 personas)**
   - Necesitan consistencia arquitectónica sin un arquitecto dedicado
   - El Blueprint estandariza las reglas para todo el equipo

3. **Consultoras de desarrollo**
   - Necesitan replicar su stack estándar en cada proyecto nuevo
   - Un CLI que genera proyectos pre-configurados ahorra días de setup

4. **Solo-founders / "Arquitectos Agénticos"**
   - Personas que piensan la arquitectura y delegan la implementación a IA
   - El perfil exacto de Benjamín

**Geografía:**
- Actualmente en español (comunicación, docs, prompts del CLI)
- Mercado hispanoamericano primero, con potencial global si se traduce

### 5.2 Value Proposition por Segmento

| Segmento | Value Proposition | ROI Estimado |
|----------|-------------------|--------------|
| Developer individual | "Tus reglas se cumplen solas. Deja de corregir al agente." | Horas/día ahorradas en correcciones |
| Equipo pequeño | "Arquitectura enterprise sin arquitecto. Un Blueprint para todos." | Reducción de code review, menos bugs arquitectónicos |
| Consultora | "Genera 10 proyectos idénticos en 10 minutos." | Días de setup → minutos |
| Solo-founder | "Compite con una agencia de 10 personas. Solo." | Multiplicador de productividad |

---

## 6. MODELO DE NEGOCIO PROPUESTO

### 6.1 Estrategias de Monetización

**Modelo actual:** Open Source (MIT License)

**Opciones analizadas (basado en contexto del proyecto):**

| Estrategia | Descripción | Pricing sugerido | Pros | Contras |
|------------|-------------|------------------|------|---------|
| **Open Core** | CLI gratis, Blueprints premium (ej: con RAG, MCP Server) | $29-99/mes por Blueprint premium | Comunidad + revenue | Difícil defender valor vs copiar templates |
| **Services + Product** | CLI gratis, consulting para implementación | $100-200/h consultoría | Ingreso inmediato, low overhead | No escala, time-for-money |
| **SaaS (Cloud Dashboard)** | Dashboard web para gestionar Blueprints, métricas, updates | $19-49/mes | Recurring revenue, escalable | Alto costo de desarrollo, complejidad |
| **Marketplace** | Vender Blueprints/plugins para diferentes industrias | $49-199/Blueprint | Ingreso por unidad, baja barrera | Requiere catálogo amplio |
| **Freemium** | CLI gratis con features básicas, premium para advanced | Free + $15-29/mes premium | Adoptción rápida + upsell | Feature gating complejo |

**Recomendación para Benjamín (solo-founder):**

La estrategia más viable como solo-founder es **Services + Product**:
1. **Fase 1:** Open source el CLI, construir reputación
2. **Fase 2:** Ofrecer consulting de implementación usando el CLI como base
3. **Fase 3:** Si hay tracción, evaluar SaaS o marketplace

### 6.2 Go-to-Market Strategies

#### Content-Led Growth
- **Pasos:** Blog posts/videos mostrando Koa en acción, comparaciones con desarrollo sin guardrails
- **Timeline:** Semana 1-4 (crear contenido), ongoing
- **Costos:** Tiempo de Benjamín
- **Expected outcome:** Awareness en comunidad Angular hispana

#### Community-Led Growth
- **Pasos:** Publicar en NPM, crear Discord, contribuir en foros Angular
- **Timeline:** Semana 1-2 (NPM publish), Semana 3+ (comunidad)
- **Costos:** Mínimo (tiempo)
- **Expected outcome:** Early adopters, feedback, PRs

#### Partnership-Led Growth
- **Pasos:** Contactar creadores de contenido Angular (ej: Web Reactiva), proponer integración
- **Timeline:** Mes 2-3
- **Costos:** Tiempo de networking
- **Expected outcome:** Alcance multiplicado, validación de mercado

#### Product-Led Growth
- **Pasos:** `npx create-koa-agent` que "just works", excelente README, demo projects
- **Timeline:** Requiere NPM publish primero
- **Costos:** Tiempo de polish
- **Expected outcome:** Adopción orgánica via NPM downloads

---

## 7. ROADMAP Y PRÓXIMOS PASOS

### 7.1 Gaps Identificados

1. **No publicado en NPM:** El CLI funciona localmente pero no es instalable via `npx`
2. **Falta de usuarios externos:** Solo Benjamín y proyectos internos lo han usado
3. **Posible acoplamiento a workflow personal:** Las reglas reflejan las preferencias de Benjamín, pueden no ser universales
4. **Angular-only:** Limita el mercado potencial
5. **Documentación en español:** Barrera para adopción global
6. **Sin tests del CLI:** `bin/index.js` no tiene suite de tests
7. **Sin CI/CD:** No hay pipeline automatizado para el CLI
8. **Sin versionado semántico publicado:** Solo `blueprint.json` internamente

### 7.2 Plan de Validación (v7.0)

**Fase 0 — Validación de v6 (Gate obligatorio):**

| Tarea | Criterio de éxito |
|-------|-------------------|
| Generar proyecto con `--no-supabase` | Compila, lint:arch pasa, hooks no lanzan errores |
| Generar proyecto con `--no-gsap` | Compila, animaciones no referenciadas |
| Generar proyecto full (default) | Compila, `ng serve` funciona, dashboard renderiza |
| Ejecutar `npm run indices:sync` | Los 4 índices se regeneran correctamente |
| Ejecutar `npm run lint:arch` | 0 errores, warnings esperados |

**Fases 1-4 (v7.0):**

| Fase | WIs | Estimación | Descripción |
|------|-----|------------|-------------|
| Fase 1 | 7-02, 7-04 | 1 sesión | Facades delgadas + pipeline LESSONS |
| Fase 2 | 7-05 | 1-2 sesiones | RAG boilerplate (pgvector, Edge Function) |
| Fase 3 | 7-06 | 1-2 sesiones | MCP Server scaffold |
| Fase 4 | 7-03 | 1 sesión | Custom rules via .yml |

**Total estimado para v7.0:** 4-6 sesiones de trabajo

### 7.3 Decisiones Pendientes

1. **¿Angular-only vs multi-framework?** — Actualmente Angular-only. Expandir a React/Vue requeriría reescribir la mayoría del Blueprint
2. **¿Open source vs propietario?** — Actualmente MIT. La ventaja competitiva no está en el código sino en el diseño del sistema
3. **¿NPM publish?** — Blocker principal para adopción externa. Sin esto, solo se instala via `git clone`
4. **¿Español vs inglés?** — Docs y CLI en español limitan adopción global pero maximizan mercado hispano
5. **¿v7 features vs validación v6?** — Gate de validación existe pero aún no se ha ejecutado formalmente

---

## 8. ANÁLISIS DE RIESGOS

### 8.1 Riesgos Técnicos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| **Commoditization de AI tools** — Los propios IDEs (Cursor, Windsurf) agregan guardrails nativos | Alta (12-18 meses) | Alto | Diferenciación via especialización Angular + patrones enterprise |
| **Angular market share decline** — Angular pierde relevancia frente a React/Next.js | Media | Alto | Monitorear, preparar arquitectura para multi-framework |
| **Claude Code cambia API de hooks** — Breaking changes en el sistema de hooks | Media | Alto | Mantener compatibilidad, actualizar rápido, blueprint.json como versioning |
| **Dependencia de Anthropic** — Koa solo funciona con Claude Code | Alta | Medio | Los rules y linter funcionan sin hooks; solo pierde enforcement en tiempo real |
| **Complejidad creciente** — Más reglas = más falsos positivos = frustración | Media | Medio | ARCH-09/10 como warnings, no errores. Custom rules desactivables |

### 8.2 Riesgos de Negocio

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| **No encuentra product-market fit** — Nadie fuera de Benjamín lo necesita | Media | Crítico | Validar con 5-10 usuarios externos antes de invertir más |
| **Timing** — La ventana de "guardrails para IA" se cierra si los IDE lo integran nativo | Alta | Alto | Moverse rápido: NPM publish → contenido → comunidad |
| **Recursos limitados** — Solo Benjamín, sin equipo | Alta | Medio | Open source → atraer contribuidores |
| **Acoplamiento personal** — Las reglas reflejan gustos de Benjamín, no estándares universales | Media | Medio | Hacer reglas configurables (custom rules v7.3), documentar el "por qué" |

### 8.3 Mitigaciones Propuestas

1. **Publicar en NPM ASAP** — Es el blocker #1 para validación externa
2. **Crear 2-3 demo projects** — Proyectos completos generados con Koa para mostrar el resultado
3. **Buscar 5-10 beta testers** — Desarrolladores Angular en la comunidad hispana
4. **Documentar en inglés** — Al menos README y CLAUDE.md para alcance global
5. **Modularizar reglas** — Que el usuario pueda elegir qué reglas activar/desactivar

---

## 9. PROYECCIONES (basadas en el mercado chileno de AI Engineering)

### 9.1 Contexto del Mercado

Según el estudio incluido en `docs/ESTUDIO.md`, el mercado de AI Orchestration Engineering en Chile muestra:

| Métrica | Valor |
|---------|-------|
| Salario promedio AI Engineer (Chile) | ~$4,200 USD/mes |
| Rango Senior AI Engineer (Chile) | $3,500 - $4,000 USD/mes |
| Rango Senior AI Engineer (US remoto) | $13,333 - $20,833 USD/mes |
| Ahorro nearshore LATAM vs US | 60-70% |
| Chile en Global Startup Ecosystem Index | #37 mundial, #3 Sudamérica |

### 9.2 Posición de Benjamín en el Mercado

El perfil de Benjamín (Angular + Supabase + MCP + agentes IA) tiene un encaje excepcional con el mercado de AI Orchestration Engineering:

- **Angular + Supabase:** Stack enterprise moderno con RAG-ready (pgvector)
- **claude-agent-cli:** Experiencia documentada en orquestación de agentes
- **MCP:** Dominio del protocolo de contexto de Anthropic
- **Koa como portfolio piece:** Demuestra capacidad de diseño de sistemas, no solo implementación

---

## 10. INFORMACIÓN DEL CREADOR

### 10.1 Perfil de Benjamín Rebolledo

- **Background técnico:** Desarrollador full-stack con expertise profundo en Angular
- **Stack principal:** Angular 20+ / PrimeNG / Supabase / GSAP / Tailwind v4
- **Experiencia relevante:**
  - Proyecto Autoescuela: Aplicación de gestión completa que originó los patrones del Blueprint
  - App Familiar v2: Migración de MVP a Blueprint v5.1 (50+ tablas Supabase)
  - claude-agent-cli: Diseño y construcción del CLI completo (v1.0 → v6.0)
- **Plataforma:** Windows 10 Pro, Claude Code CLI como entorno principal de desarrollo
- **Marca/Empresa:** AION SpA (mencionada en opiniones externas)

### 10.2 Contexto de Desarrollo

- Koa fue construido iterativamente a lo largo de múltiples versiones (v1 → v6.0)
- Cada versión incorporó aprendizajes de proyectos reales (Autoescuela, App Familiar)
- El Blueprint refleja patrones que funcionaron en producción, no teoría

---

## 11. RECURSOS Y REFERENCIAS

### 11.1 Archivos Clave del Repositorio

| Archivo | Propósito |
|---------|-----------|
| `bin/index.js` | CLI principal (606 líneas, ESM) |
| `package.json` | Metadata del CLI |
| `README.md` | Documentación pública |
| `CLAUDE.md` | Directiva maestra del proyecto |
| `templates/` | Todo lo que se inyecta en proyectos |
| `docs/SISTEMA-ACTUAL.md` | Descripción técnica del sistema |
| `docs/ESTUDIO.md` | Estudio de mercado AI Engineering |
| `docs/tareas.md` | Plan de implementación v7.0 |
| `docs/opinion.md` | Análisis externo (Gemini) del roadmap |

### 11.2 Stack Tecnológico Completo

**CLI:**
- Node.js ≥20 (ESM)
- inquirer ^13.3.0
- chalk ^5.6.2
- ora ^9.3.0

**Proyecto generado:**
- Angular 20+ (latest)
- Tailwind CSS v4 + @tailwindcss/postcss
- PrimeNG + @primeng/themes (Aura)
- GSAP
- @supabase/supabase-js
- lucide-angular
- @angular/animations (async)
- Google Fonts (Bricolage Grotesque)

**Herramientas de desarrollo:**
- TypeScript Compiler API (auto-indexing, AST linting)
- Prettier (auto-format via hook)
- Claude Code CLI (ejecución de hooks)
- Supabase CLI (migraciones locales)

---

## 12. APÉNDICES

### A. Glosario Técnico

| Término | Definición |
|---------|------------|
| **Guardrails** | Constraints automáticos que previenen que un agente IA viole reglas arquitectónicas. En Koa, implementados como hooks de Claude Code |
| **Hooks** | Scripts JavaScript que Claude Code ejecuta automáticamente en eventos específicos (PreToolUse, PostToolUse, SessionStart, Stop) |
| **Progressive Disclosure** | Técnica donde el contexto se revela al agente gradualmente según lo necesita, en vez de cargar todo al inicio |
| **Skills** | Documentos con instrucciones especializadas que el agente puede invocar para tareas específicas (ej: crear componente, implementar formulario) |
| **MCP** | Model Context Protocol — estándar abierto de Anthropic para que aplicaciones proporcionen contexto a modelos de IA via cliente-servidor |
| **Facade** | Patrón de diseño donde un servicio actúa como único punto de entrada para un dominio de datos, centralizando estado y acceso a infraestructura |
| **Smart Component** | Componente Angular que inyecta Facades y coordina componentes presentacionales (vive en `features/`) |
| **Dumb Component** | Componente Angular puramente presentacional con solo `input()` y `output()` (vive en `shared/`) |
| **SWR** | Stale-While-Revalidate — patrón donde se muestran datos cacheados inmediatamente mientras se refresca en background |
| **Blueprint** | Conjunto completo de reglas, hooks, docs, índices y boilerplate que Koa inyecta en un proyecto |
| **Shadow CI** | Sistema de validación que funciona como un CI/CD pero ejecutado localmente y en tiempo real por los hooks |
| **Design Tokens** | Variables CSS semánticas que abstraen los valores visuales del sistema de diseño (ej: `var(--ds-brand)` en vez de `#2563eb`) |
| **Bento Grid** | Sistema de layout basado en grillas irregulares con tamaños predefinidos (square, wide, tall, feature, hero) |
| **OnPush** | Estrategia de detección de cambios de Angular que solo re-renderiza cuando las referencias de los inputs cambian |
| **Agentic TDD** | Variante de TDD donde el agente IA escribe tests primero, implementa después, y auto-corrige hasta que pasen |
| **AI-Readability** | Atributos `data-llm-*` en el HTML que permiten a otros agentes IA entender la semántica de la UI sin alucinaciones |
| **Context Injection** | Mecanismo del Pre-Write Guard que inyecta automáticamente las reglas relevantes al contexto del agente según el tipo de archivo editado |

### B. Arquitectura de los 6 Pilares (v5.0+)

1. **Context Engineering (LSP vía MCP):** Conectividad nativa a `ts-lsp-mcp`. La IA consulta el AST completo para inferir tipos y referencias cruzadas
2. **Orquestación Atomizada (MCP):** Configuración lista para Model Context Protocol. La IA delega a herramientas oficiales (`@angular/cli`, `supabase`)
3. **Sistema de Hooks Activos:** Constraints automáticos en tiempo real que bloquean al agente al instante si viola una regla
4. **Guardrails Programáticos (Shadow CI):** Validador AST (`architect.js`) como auditoría completa post-hoc
5. **Agentic TDD:** Prohibición sistémica de entregar Features Core sin tests unitarios
6. **Diseño Agnóstico y AI-Readability:** Bloqueo del "Vibe Coding", forzando Design Tokens e inyectando atributos `data-llm-*`

### C. Historial de Versiones del Blueprint

| Versión | Fecha | Cambios principales |
|---------|-------|---------------------|
| v1.0-v4.0 | Pre-2026 | Evolución iterativa de reglas y estructura |
| v5.0 | ~2026-03 | Introducción del sistema de hooks (6 hooks) |
| v5.1 | ~2026-03-16 | Cimientos UI/UX v2 (Lucide, semántica, KPI cards) |
| v6.0 | 2026-03-19 | 10 WIs: preflight, rollback, blueprint.json, auto-indexing, flags condicionales |
| v7.0 | Planificado | RAG, MCP Server, custom rules, facades delgadas |

### D. Estructura Completa de `templates/`

```
templates/
├── .claude/
│   ├── CLAUDE.md
│   ├── hooks/
│   │   ├── pre-write-guard.js
│   │   ├── discovery-tracker.js
│   │   ├── bash-guard.js
│   │   └── compact-recovery.js
│   ├── rules/
│   │   ├── architecture.md
│   │   ├── models.md
│   │   ├── facades.md
│   │   ├── visual-system.md
│   │   ├── notifications.md
│   │   ├── swr-pattern.md
│   │   ├── testing-tdd.md
│   │   ├── ai-readability.md
│   │   └── database.md
│   ├── skills/
│   │   ├── angular-component.md
│   │   ├── angular-forms.md
│   │   ├── angular-primeng.md
│   │   ├── angular-signals.md
│   │   ├── design-system.md
│   │   ├── supabase-data-model.md
│   │   └── sync-indices.md
│   ├── settings.json
│   └── settings.local.json
├── boilerplate/
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/ (facades, services, models, utils)
│   │   │   ├── features/ (smart components)
│   │   │   ├── shared/ (dumb components: icon, kpi-card, skeleton-block)
│   │   │   └── layout/ (shell, sidebar, topbar)
│   │   ├── styles/
│   │   │   ├── tokens/_variables.scss
│   │   │   └── vendors/_primeng-overrides.scss
│   │   └── tailwind.css
│   ├── scripts/
│   │   ├── architect.js
│   │   ├── indices-sync.js
│   │   └── lint-arch-wrapper.js
│   └── postcss.config.json
├── docs/
│   ├── TECH-STACK-RULES.md
│   ├── HOOKS-SYSTEM.md
│   ├── CLAUDE-USER-GUIDE.md
│   ├── BRAND_GUIDELINES.md
│   └── PRODUCT-VISION.md
├── indices/
│   ├── COMPONENTS.md
│   ├── SERVICES.md
│   ├── FACADES.md
│   ├── MODELS.md
│   ├── DIRECTIVES.md
│   ├── PIPES.md
│   ├── STYLES.md
│   ├── DATABASE.md
│   └── ANTI-PATTERNS.md
├── CLAUDE.md
├── .mcp.json
└── gitignore.template
```

---

*Documento generado el 2026-03-23 basado en el código fuente de `koa-agent-cli` v6.0.0 y la documentación del proyecto.*
