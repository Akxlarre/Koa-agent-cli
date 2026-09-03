---
enforcement: social
paths:
  - "src/app/**/*.html"
  - "src/app/**/*.scss"
  - "src/app/shared/**/*.ts"
  - "src/app/features/**/*.ts"
  - "src/app/layout/**/*.ts"
  - "src/styles/**/*.scss"
---

# Sistema Visual

> Lo que ningún chequeo puede verificar, y por eso se paga en contexto siempre.
> El vocabulario está en `visual-tokens.md`; la composición de pantalla, en
> `visual-patterns.md`.

## Prioridad de UI

1. `indices/COMPONENTS.md` — ¿Existe algo reutilizable del Design System local?
2. `PrimeNG` — Para inputs complejos, tablas, calendarios, dropdowns
3. Componente custom — Solo si 1 y 2 no cubren la necesidad

## Regla 3-2-1 de Marca (Brand Color Discipline)

El color de marca `var(--ds-brand)` debe aparecer en **máximo 3 elementos por viewport**:
- **2 interactivos** → CTAs primarios, links de acción, botones `.btn-primary`
- **1 decorativo** → borde de `.card-accent`, indicador de sección activa, o highlight visual

**PROHIBIDO:**
- Usar `var(--ds-brand)` en texto largo o de cuerpo
- Fondos de sección completos con el brand color (usar `.surface-hero` en su lugar)
- Más de 1 elemento puramente decorativo de marca por viewport
