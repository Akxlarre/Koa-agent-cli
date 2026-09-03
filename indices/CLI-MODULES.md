# CLI Modules — Registro de Módulos del Generador

> Fuente de verdad para la arquitectura de `bin/` y `lib/`.
> Actualiza esta tabla al agregar, modificar o eliminar módulos.

## Entry Point

| Archivo | Responsabilidad | Tamaño actual |
|---------|----------------|---------------|
| `bin/index.js` | Entry point: resuelve stack, ejecuta preflight, muestra inquirer prompts, orquesta el flujo de scaffolding. Sin lógica de negocio propia. | 122 líneas (techo declarado: ~150, con test) |

## lib/ — Módulos especializados

| Módulo | Responsabilidad | Exports principales | Dependencias externas |
|--------|----------------|---------------------|-----------------------|
| `lib/config.js` | Resolución de stack desde CLI flags y koa-config.json. Validación de nombres de proyecto y del schema de `blueprint.json` (contrato compartido con Wikiflow: `tier`/`team`/`product` opcionales, `scaffoldMode` con alias legacy `mode`). Constantes globales. | `BLUEPRINT_VERSION`, `MIN_NODE_MAJOR`, `ANGULAR_MAJOR`, `resolveStack()`, `validateProjectName()`, `validateBlueprintJson()`, `parseMajor()`, `parseJsonc()` | fs, path, chalk |
| `lib/runner.js` | Wrapper `spawn` asíncrono para comandos externos. Plataforma-aware (Windows .cmd). | `run(cmd, args, opts)`, `NPM`, `NPX` | child_process |
| `lib/preflight.js` | Verificación de requisitos del sistema. Termina con exit(1) si falta npm/npx. Warnings para git/docker. | `preflight()`, `checkCommand(cmd, args, opts)` | child_process, chalk, lib/config.js |
| `lib/installer.js` | Instalación de dependencias npm condicionales por stack. Creación del proyecto Angular base con `ng new <projectName>` dentro de un directorio padre temporal. Pinea Angular a `ANGULAR_MAJOR` y alinea los satélites (`@angular/animations`) al major instalado. | `createAngularProject(projectName, tempParentDir)`, `installDependencies(targetDir, stack)` | lib/runner.js, lib/config.js, fs, path, chalk, ora |
| `lib/scaffolder.js` | Copia de templates al directorio destino **respetando lo que ya existe** (`CLI_OWNED` = harness sobrescribible; el resto se preserva). Patching de tsconfig, angular.json, index.html, app.config.ts y `.mcp.json` (`{{ANGULAR_MAJOR}}`). Los tres primeros son **requeridos**: si faltan, para (`patch()`). Merge de blueprint.json. Sin npm. | `copyTemplates(templatesDir, targetDir, projectName, stack)`, `injectBoilerplate(templatesDir, targetDir, stack)`, `writeBlueprintJson(targetDir, isFull, stack)` | fs, path, chalk, lib/config.js |
| `lib/generator.js` | Generador de artefactos para proyectos KoA existentes. Subcomando `generate feature [nombre] [--type list\|detail\|form] [--singular Nombre]`. Valida blueprint.json, resuelve variables de nomenclatura, escribe 5-7 archivos sin sobreescribir. | `runGenerate(args)` | fs, path, chalk, inquirer, lib/feature-templates.js |
| `lib/feature-templates.js` | Plantillas de código para el generador de features. Sin lógica, solo strings con `{{domain}}`, `{{Domain}}`, `{{Domains}}`. | `FEATURE_TEMPLATES` (11 entradas: repository, facade, facade-detail, smart-page, smart-page-detail, smart-page-form, dumb-card, dumb-skeleton, repository-spec, facade-spec, facade-detail-spec) | — |
| `lib/prompts.js` | De dónde salen las respuestas: prompts de inquirer y los dos modos de `TEST_MODE`. Sin FS ni spawn — qué se hace con las respuestas es de `bin/index.js`. | `askWhatToBuild()`, `esFullScaffold(action)`, `applyAiTools(stack, aiTools)` | inquirer, path, lib/config.js |
| `lib/ui.js` | Salida visual: banner ASCII y mensaje de éxito con próximos pasos. Sin FS ni spawn. | `printBanner()`, `printSuccess(projectName, isFull, targetDir)` | chalk, lib/config.js |

## Subcomandos

| Subcomando | Uso | Descripción |
|------------|-----|-------------|
| `generate feature [nombre] [--type list\|detail\|form]` | Dentro de un proyecto KoA existente | Genera archivos pre-conectados según el tipo: **list** (7 archivos: repository + facade + smart-page + dumb-card + skeleton + 2 specs), **detail** (5: repository + facade-detail + smart-page-detail + 2 specs), **form** (5: repository + facade + smart-page-form + 2 specs). Default: `list`. Si se omite `[nombre]`, muestra prompt interactivo con selector de tipo. `--singular` corrige el nombre del modelo cuando la heurística del plural falla (`categories` → `Categorie`); en modo interactivo el prompt ya lo ofrecía. |

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

## Tests del generador (`test/`) — `npm test`

Corren con `node --test *.test.mjs` desde la raíz. No confundir con las cuatro suites del
payload, que corren en el layout de un proyecto generado (ver `TEMPLATES-REGISTRY.md`).

| Archivo | Qué fija |
|---|---|
| `test/scaffolder.test.mjs` | Precedencia de copia: el CLI corrido dentro de una carpeta con trabajo del usuario no lo pisa (`CLI_OWNED` vs. lo que se preserva) |
| `test/patch-contract.test.mjs` | Los 9 parches sobre la salida de `ng new`. Los tres requeridos paran el CLI si el archivo no está (`HUE-022`) |
| `test/jsonc.test.mjs` | `parseJsonc` respeta strings: un `tsconfig.json` con `$schema` no pierde los path aliases (`HUE-020`) |
| `test/templates-sql.test.mjs` | Las migraciones que viajan al proyecto cumplen las reglas RLS que el propio linter emite |
| `test/generador-callado.test.mjs` | El generador de features no escribe sobre archivos existentes |
| `test/smoke-comprobaciones.test.mjs` | **Cruza la dualidad**: `COMPROBACIONES` (payload) contra los scripts que emite `lib/scaffolder.js` (generador). Único lugar donde los dos contextos se miran (`ACO-010`) |
| `test/integracion/ng-new.test.mjs` | `npm run test:integracion` — corre `ng new` de verdad y le pasa `architect.js` encima (`HUE-021`, `HUE-022`) |
