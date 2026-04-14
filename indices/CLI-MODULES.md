# CLI Modules — Registro de Módulos del Generador

> Fuente de verdad para la arquitectura de `bin/` y `lib/`.
> Actualiza esta tabla al agregar, modificar o eliminar módulos.

## Entry Point

| Archivo | Responsabilidad | Tamaño actual |
|---------|----------------|---------------|
| `bin/index.js` | Entry point: resuelve stack, ejecuta preflight, muestra inquirer prompts, orquesta el flujo de scaffolding. Sin lógica de negocio propia. | ~115 líneas |

## lib/ — Módulos especializados

| Módulo | Responsabilidad | Exports principales | Dependencias externas |
|--------|----------------|---------------------|-----------------------|
| `lib/config.js` | Resolución de stack desde CLI flags y koa-config.json. Validación de nombres de proyecto. Constantes globales. | `BLUEPRINT_VERSION`, `MIN_NODE_MAJOR`, `resolveStack()`, `validateProjectName()`, `parseMajor()`, `parseJsonc()` | fs, path, chalk |
| `lib/runner.js` | Wrapper `spawn` asíncrono para comandos externos. Plataforma-aware (Windows .cmd). | `run(cmd, args, opts)`, `NPM`, `NPX` | child_process |
| `lib/preflight.js` | Verificación de requisitos del sistema. Termina con exit(1) si falta npm/npx. Warnings para git/docker. | `preflight()`, `checkCommand(cmd, args, opts)` | child_process, chalk, lib/config.js |
| `lib/installer.js` | Instalación de dependencias npm condicionales por stack. Creación del proyecto Angular base con ng new. Gestiona sus propios spinners y lanza Error en fallo. | `createAngularProject(projectName, tempDir)`, `installDependencies(targetDir, stack)` | lib/runner.js, chalk, ora |
| `lib/scaffolder.js` | Copia de templates al directorio destino. Patching de tsconfig, angular.json, index.html, app.config.ts. Escritura de blueprint.json. Sin npm. | `copyTemplates(templatesDir, targetDir, projectName)`, `injectBoilerplate(templatesDir, targetDir, stack)`, `writeBlueprintJson(targetDir, projectName, isFull, stack)` | fs, path, chalk, lib/config.js |
| `lib/generator.js` | Generador de artefactos para proyectos KoA existentes. Subcomando `generate feature [nombre] [--type list\|detail\|form]`. Valida blueprint.json, resuelve variables de nomenclatura, escribe 5-7 archivos sin sobreescribir. | `runGenerate(args)` | fs, path, chalk, inquirer, lib/feature-templates.js |
| `lib/feature-templates.js` | Plantillas de código para el generador de features. Sin lógica, solo strings con `{{domain}}`, `{{Domain}}`, `{{Domains}}`. | `FEATURE_TEMPLATES` (11 entradas: repository, facade, facade-detail, smart-page, smart-page-detail, smart-page-form, dumb-card, dumb-skeleton, repository-spec, facade-spec, facade-detail-spec) | — |
| `lib/ui.js` | Salida visual: banner ASCII y mensaje de éxito con próximos pasos. Sin FS ni spawn. | `printBanner()`, `printSuccess(projectName, isFull, targetDir)` | chalk, lib/config.js |

## Subcomandos

| Subcomando | Uso | Descripción |
|------------|-----|-------------|
| `generate feature [nombre] [--type list\|detail\|form]` | Dentro de un proyecto KoA existente | Genera archivos pre-conectados según el tipo: **list** (7 archivos: repository + facade + smart-page + dumb-card + skeleton + 2 specs), **detail** (5: repository + facade-detail + smart-page-detail + 2 specs), **form** (5: repository + facade + smart-page-form + 2 specs). Default: `list`. Si se omite `[nombre]`, muestra prompt interactivo con selector de tipo. |

## Flags CLI (scaffolding inicial)

| Flag | Default | Efecto |
|------|---------|--------|
| `--no-supabase` | supabase=true | Excluye Supabase del stack |
| `--no-primeng` | primeng=true | Excluye PrimeNG del stack |
| `--with-gsap` | gsap=false | Incluye GSAP en el stack |
| `--with-ngrx-signals` | ngrxSignals=false | Incluye NgRx Signal Store |
| `--with-e2e` | e2e=false | Incluye Playwright E2E |

## Variables de entorno

| Variable | Valores | Efecto |
|----------|---------|--------|
| `TEST_MODE` | `inject` | Salta inquirer, usa modo inject-only |
| `TEST_MODE` | cualquier otro valor truthy | Salta inquirer, usa Full Scaffold con `TEST_PROJECT_NAME` |
| `TEST_PROJECT_NAME` | string | Nombre del proyecto en TEST_MODE full scaffold |
