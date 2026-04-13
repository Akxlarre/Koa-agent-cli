<!-- spec-version: {{GENERATED_AT}} -->
<!-- auto-refresh: indices:sync -->

# Registro de Facades

> **Regla de Actualización (OBLIGATORIA):** El Agente DEBE registrar toda Facade nueva en esta tabla al crearla. Antes de crear una Facade, verificar aquí si ya existe una que cubra el dominio. Duplicar Facades para el mismo dominio es un error arquitectónico grave.

## Facades de Dominio

| Facade | Dominio | Signals Expuestos | Ubicación | Estado |
|--------|---------|-------------------|-----------|--------|
| `AuthFacade` | Autenticación | `currentUser`, `isAuthenticated`, `isLoading` | `core/services/auth.facade.ts` | ✅ Estable |

<!-- DETAIL:BEGIN -->
## Auto-Index — Facades detectadas por AST (generado automáticamente)

<!-- AUTO-GENERATED:BEGIN -->
_Sin facades auto-detectadas aún. Ejecuta `npm run indices:sync` para poblar._
<!-- AUTO-GENERATED:END -->
