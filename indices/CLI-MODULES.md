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
| `lib/ui.js` | Salida visual: banner ASCII y mensaje de éxito con próximos pasos. Sin FS ni spawn. | `printBanner()`, `printSuccess(projectName, isFull, targetDir)` | chalk, lib/config.js |

## Flags CLI

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
