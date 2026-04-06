# E2E Testing con Playwright

## Setup inicial (una vez)

```bash
npx playwright install
```

## Comandos

```bash
npm run e2e          # Ejecutar todos los tests headless
npm run e2e:ui       # Abrir UI interactiva de Playwright
npm run e2e:headed   # Ejecutar con browser visible
npm run e2e:report   # Ver reporte HTML del último run
```

## Escribir tests

- Archivos en `e2e/` con extensión `.spec.ts`
- Usar `page.locator()` con selectores semánticos (`data-testid`, roles ARIA)
- Patrón: **Arrange** (`goto`) → **Act** (`click`, `fill`) → **Assert** (`expect`)

## Agregar `data-testid` a componentes críticos

```html
<!-- Marcar elementos que E2E necesita identificar -->
<button data-testid="submit-btn" class="btn-primary">Guardar</button>
<div data-testid="user-menu">...</div>
```

## CI

Los tests E2E se ejecutan en el pipeline de CI con `npm run e2e` (headless, retries: 2).
El servidor Angular (`ng serve`) se inicia automáticamente si no está corriendo.
