---
description: Cerrar el hotfix track activo (marca como done, limpia .active)
argument-hint: ""
allowed-tools: Read, Write, Bash, Glob
---

# /hotfix-close — Cerrar el Hotfix Track Activo

Simétrico con `/fix-close`. **Este es el camino normal para cerrar un hotfix**: quien
sabe si el trabajo terminó es quien lo hizo, no un hook.

`sdd/hotfix-autoclose.js` sigue existiendo, pero como red de seguridad — corre en
`SessionEnd` y recoge el track que quedó abierto porque alguien se olvidó de cerrarlo.
Antes corría en `Stop`, que es el final de cada **respuesta**: cerraba el hotfix en el
primer turno y a partir de ahí el `spec-gate` bloqueaba el trabajo pidiendo la spec que
el propio hook acababa de borrar.

## Procedimiento

1. Leer `specs/.active`:
   - Si está vacío → error "No hay track activo. Nada que cerrar."
   - Si el ID NO empieza con `hotfix-` → error "El activo no es un hotfix. Usa
     `/fix-close` para un fix o `/spec-verify` para una spec."

2. Ubicar `hotfix.md`, en este orden:
   - `specs/hotfixes/<id>/hotfix.md`
   - `specs/fixes/hotfixes/<id>/hotfix.md` (ruta legacy pre-migración)
   - Si no existe en ninguna → avisar y continuar igual con el paso 4: dejar
     `specs/.active` apuntando a un track que no existe es peor que cerrarlo.

3. Actualizar `hotfix.md`:
   - Cambiar `status: in_progress` → `status: done`
   - Agregar `closed: <fecha de hoy>` después del campo `status:`, si no está ya

4. Limpiar `specs/.active`: escribir contenido vacío.

5. Si `hotfix.md` tiene `refs: ASG-X-NNN` (viene de una Asignación reclamada), correr
   `npm run assignments:sync` para que `specs/ASSIGNMENTS.md` refleje el cierre.

6. Imprimir confirmación:
   ```
   ✅ Hotfix <id> cerrado.

   Resumen:
     - specs/hotfixes/<id>/hotfix.md → status: done
     - specs/.active → vacío

   El spec-gate volverá a bloquear escrituras en código de producto.
   ```

## Notas

- `/hotfix-close` NO hace commit. El usuario commitea cuando quiera.
- Si durante el hotfix apareció complejidad inesperada (contratos públicos, decisiones de
  diseño, BD) → cerralo igual y abrí `/fix-new` o `/spec-new` para lo que falta.
- Un hotfix cerrado no se reabre. Los IDs no se reutilizan.
