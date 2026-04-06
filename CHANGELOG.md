# Changelog — Koa Agent Blueprint

Formato basado en [Keep a Changelog](https://keepachangelog.com/). Solo se documentan **breaking changes** y **cambios que afectan proyectos generados**.

Para migrar un proyecto existente entre versiones, sigue las instrucciones de cada sección "Migración".

---

## [6.1.0] — 2026-03-26

### Changed
- **indices-sync.js**: Ahora usa cache incremental por mtime. Solo re-parsea archivos modificados desde la última ejecución. Cache en `.claude/temp/indices-cache.json` (ya en `.gitignore`).
- **testing-tdd.md**: Dumb components sin lógica ya no requieren tests obligatorios. Solo obligatorio si tienen `computed()` o lógica derivada.
- **Bug Fix**: Se añadió `templates/.claude/hooks/package.json` para forzar `type: commonjs` en los hooks. Esto evita errores de `require is not defined` en proyectos que usan `type: module` (ESM).

### Migración desde 6.0
1. Reemplazar `scripts/indices-sync.js` con la versión nueva
2. Reemplazar `.claude/rules/testing-tdd.md` con la versión nueva
3. No hay breaking changes — el cache se genera automáticamente en la primera ejecución

---

## [6.0.0] — 2026-03-19

### Added
- `preflight()` + `checkCommand()` + `validateProjectName()` (regex, 214 chars, Windows reserved words)
- NPM/NPX con `.cmd` suffix en Windows + `shell: platform === 'win32'`
- Scaffold en directorio temporal con rollback automático via `fs.rmSync(tempDir)`
- `blueprint.json` en raíz del proyecto generado con versión y metadata
- Objeto `RULES` con doc links en `architect.js` + `reportError()`/`reportWarning()` con códigos `[ARCH-NN]`
- ARCH-09 (shared >200 líneas) y ARCH-10 (facade >5 inject o método >50 líneas) como warnings
- `indices/ANTI-PATTERNS.md` con 5 anti-patrones documentados
- `scripts/indices-sync.js` — auto-indexer AST para 4 índices (COMPONENTS, SERVICES, FACADES, MODELS)
- `scripts/lint-arch-wrapper.js` — memoria de fallos en `.claude/temp/arch-last-failure.json`
- Flags `--no-supabase`, `--no-gsap`, `--no-primeng` + `koa-config.json` opcional

### Migración desde 5.1
1. Agregar `blueprint.json` manualmente a la raíz del proyecto:
   ```json
   { "name": "koa-agent-blueprint", "version": "6.0.0", "stack": { "angular": true, "tailwind": true, "primeng": true, "gsap": true, "supabase": true } }
   ```
2. Agregar marcadores `<!-- AUTO-GENERATED:BEGIN -->` / `<!-- AUTO-GENERATED:END -->` a cada `indices/*.md`
3. Copiar `scripts/indices-sync.js` y `scripts/lint-arch-wrapper.js`
4. Agregar a `package.json`: `"indices:sync": "node scripts/indices-sync.js"`
5. Copiar `indices/ANTI-PATTERNS.md`

---

## [5.1.0] — 2026-03-16

### Added
- **ToastService** — wrapper sobre PrimeNG MessageService con duraciones pre-configuradas
- **core/utils/** — `date.utils.ts`, `validation.utils.ts` con barrel export
- **Tailwind @utility** — `btn-primary`, `btn-secondary`, `btn-ghost` con tokens semánticos
- **Lucide icons** expandidos de 24 a 58 iconos curados
- **linkedSignal()** — patrón de two-way binding en Facades para formularios
- **pre-write-guard.js** actualizado con checks para MessageService directo y context injection expandido

### Changed
- `_variables.scss` — eliminado branding específico, aliases legacy
- `_primeng-overrides.scss` — 1122 a 803 líneas (limpieza de dead code)
- `tailwind.css` — btn utilities usan tokens en vez de valores hardcodeados

### Migración desde 5.0
1. Crear `core/services/toast.service.ts` y reemplazar inyecciones directas de `MessageService` en componentes
2. Crear `core/utils/` con barrel export
3. Actualizar `tailwind.css` con las nuevas `@utility`
4. Actualizar `app.config.ts` con los 58 iconos Lucide

---

## [5.0.0] — 2026-03

### Added
- Sistema de hooks completo (7 hooks): pre-write-guard, discovery-tracker, bash-guard, compact-recovery, post-edit, sync-check, file-protector
- 9 reglas arquitectónicas en `.claude/rules/`
- 7 skills con frontmatter oficial
- 8 índices de memoria viva en `indices/`
- Boilerplate Angular completo con KPI card, skeleton, icon component
- Design system con Bento Grid, Frosted Cards, GSAP animations

### Notes
- Primera versión con sistema de guardrails automáticos
- No hay migración desde versiones anteriores — generar proyecto nuevo
