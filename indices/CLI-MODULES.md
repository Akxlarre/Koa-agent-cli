# CLI Modules — Registro de Módulos del Generador

> Fuente de verdad para la arquitectura de `bin/` y `lib/`.
> Actualiza esta tabla al agregar, modificar o eliminar módulos.

## Entry Point

| Archivo | Responsabilidad | Tamaño actual |
|---------|----------------|---------------|
| `bin/index.js` | Entry point: resuelve stack, ejecuta preflight, muestra inquirer prompts (incl. confirmación de sobrescritura en inject), orquesta el flujo de scaffolding. Detecta el subcomando `generate` y delega a lib/generator.js. Sin lógica de negocio propia. | ~180 líneas |

## lib/ — Módulos especializados

| Módulo | Responsabilidad | Exports principales | Dependencias externas |
|--------|----------------|---------------------|-----------------------|
| `lib/config.js` | Resolución de stack desde CLI flags y koa-config.json. Validación de nombres de proyecto y schema de blueprint.json. Constantes globales. | `BLUEPRINT_VERSION`, `ANGULAR_CLI_VERSION`, `MIN_NODE_MAJOR`, `resolveStack()`, `validateProjectName()`, `validateBlueprintJson()`, `parseMajor()`, `parseJsonc()` | fs, path, chalk |
| `lib/runner.js` | Wrapper `spawn` asíncrono para comandos externos. Plataforma-aware (Windows .cmd). | `run(cmd, args, opts)`, `NPM`, `NPX` | child_process |
| `lib/preflight.js` | Verificación de requisitos del sistema. Termina con exit(1) si falta npm/npx. Warnings para git/docker. | `preflight()`, `checkCommand(cmd, args, opts)` | child_process, chalk, lib/config.js |
| `lib/installer.js` | Instalación de dependencias npm condicionales por stack. Creación del proyecto Angular base con `ng new <nombre> --directory <tmp> --defaults` (Angular CLI pineado a `ANGULAR_CLI_VERSION`; paquetes del ecosistema pineados al mismo major; vitest@^3 por peerOptional de @angular/build). Gestiona sus propios spinners y lanza Error en fallo. | `createAngularProject(projectName, tempDir)`, `installDependencies(targetDir, stack)` | lib/runner.js, lib/config.js, chalk, ora |
| `lib/scaffolder.js` | Copia de templates al directorio destino. Detección de colisiones para el modo inject. Patching de tsconfig, angular.json (incl. budgets 1mb/2mb), index.html, app.config.ts. Escritura de blueprint.json. Sin npm. | `copyTemplates(templatesDir, targetDir, projectName, stack)`, `listCollisions(templatesDir, targetDir)`, `injectBoilerplate(templatesDir, targetDir, stack)`, `writeBlueprintJson(targetDir, projectName, isFull, stack)` | fs, path, chalk, lib/config.js |
| `lib/generator.js` | Generador de artefactos para proyectos KoA existentes. Subcomando `generate feature [nombre] [--type list\|detail\|form]`. Valida blueprint.json, resuelve variables de nomenclatura, escribe 5-7 archivos sin sobreescribir. | `runGenerate(args)` | fs, path, chalk, inquirer, lib/feature-templates.js |
| `lib/feature-templates.js` | Plantillas de código para el generador de features. Sin lógica, solo strings con `{{domain}}`, `{{Domain}}`, `{{Domains}}`. | `FEATURE_TEMPLATES` (11 entradas: repository, facade, facade-detail, smart-page, smart-page-detail, smart-page-form, dumb-card, dumb-skeleton, repository-spec, facade-spec, facade-detail-spec) | — |
| `lib/ui.js` | Salida visual: banner ASCII, advertencia de sobrescritura y mensaje de éxito con próximos pasos. Sin FS ni spawn. | `printBanner()`, `printCollisionWarning(collisions)`, `printSuccess(projectName, isFull, targetDir)` | chalk, lib/config.js |

## Subcomandos

| Subcomando | Uso | Descripción |
|------------|-----|-------------|
| `generate feature [nombre] [--type list\|detail\|form]` | Dentro de un proyecto KoA existente | Genera archivos pre-conectados según el tipo: **list** (7 archivos: repository + facade + smart-page + dumb-card + skeleton + 2 specs), **detail** (5: repository + facade-detail + smart-page-detail + 2 specs), **form** (5: repository + facade + smart-page-form + 2 specs). Default: `list`. Si se omite `[nombre]`, muestra prompt interactivo con selector de tipo. |

## Flags CLI (scaffolding inicial)

> Precedencia uniforme: **flag CLI explícito > koa-config.json > default**.
> Un flag presente siempre gana sobre el archivo (ej: `--no-gsap` anula `gsap: true` del config).

| Flag | Default | Efecto |
|------|---------|--------|
| `--no-supabase` | supabase=true | Excluye Supabase del stack |
| `--no-primeng` | primeng=true | Excluye PrimeNG del stack |
| `--with-gsap` / `--no-gsap` | gsap=false | Animación de rutas GSAP-first: omite `withViewTransitions()` en app.config.ts. El paquete `gsap` se instala siempre (el boilerplate depende de él). |
| `--with-ngrx-signals` | ngrxSignals=false | Incluye NgRx Signal Store |
| `--with-e2e` | e2e=false | Incluye Playwright E2E |
| `--with-cursor` | cursor=false | Genera `.cursor/rules/*.mdc` (también seleccionable en el prompt) |
| `--with-windsurf` | windsurf=false | Genera `.windsurf/rules/project.md` (también seleccionable en el prompt) |
| `--force` | — | Modo inject: omite la confirmación de sobrescritura de archivos existentes |

## Variables de entorno

| Variable | Valores | Efecto |
|----------|---------|--------|
| `TEST_MODE` | `inject` | Salta inquirer, usa modo inject-only |
| `TEST_MODE` | cualquier otro valor truthy | Salta inquirer, usa Full Scaffold con `TEST_PROJECT_NAME` |
| `TEST_PROJECT_NAME` | string | Nombre del proyecto en TEST_MODE full scaffold |
