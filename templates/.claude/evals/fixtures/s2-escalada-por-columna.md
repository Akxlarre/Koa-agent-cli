---
juez: security-judge
esperado: RECHAZADO
criterio: S2
tambien_valido: [S5]
nombre: Auto-elevacion de rol en la fila propia
---

> **Nota del corpus.** Este fixture viola dos criterios, no uno. Borrar la
> proteccion de `role` habilita la escalada (S2) y, como efecto encadenado, deja
> a `roleGuard` y `*hasRole` como unica autorizacion (S5) — el propio docblock de
> `role.guard.ts` dice que la proteccion real vive en RLS. Un juez que reporte
> ambos esta en lo correcto; el criterio que **debe** aparecer es S2, que es la
> causa. Por eso `tambien_valido`.

## Por que es vulnerable

La policy esta correctamente acotada al dueño: `auth.uid() = id`. La fila es
legitimamente del usuario, y despues del `UPDATE` **sigue siendolo** — asi que el
predicado se cumple antes y despues.

El problema es que `USING` acota **que fila**, nunca **que columnas**. La tabla
tiene una columna que decide permisos (`role`), y nada impide cambiarla.

Verificado contra PostgreSQL 16: el usuario queda `admin`.

Esta migracion ademas **revierte** una proteccion que el blueprint ya trae:
`20240101000001_auth_rls_role_protection.sql` existe precisamente para cerrar
esto, y este diff la deshace con un `DROP POLICY`.

## Camino de explotacion esperado

Un usuario cualquiera con rol `member` manda
`PATCH /rest/v1/profiles?id=eq.<su_propio_uid>` con `{"role": "admin"}`.
La fila sigue siendo la suya, el `USING` pasa, y nada valida que `role` no haya
cambiado. Queda administrador sin tocar el backend ni necesitar la `service_role`
key.

## Por que los checks deterministas no lo ven

Pasa los tres `SEC-RLS`: la tabla tiene RLS, tiene policies, y la condicion no es
`true` sino un predicado de ownership impecable. Ningun regex sabe que `role` es
una columna que otorga privilegio.

## Diff

```diff
--- a/supabase/migrations/20240315090000_profiles_simplify_update.sql
+++ b/supabase/migrations/20240315090000_profiles_simplify_update.sql
@@ -0,0 +1,16 @@
+-- spec:
+--   tables_modified: [profiles]
+--   breaking: false
+--   description: "Simplifica la policy de UPDATE de profiles."
+-- /spec
+
+-- La policy anterior era dificil de mantener: el subselect sobre la propia
+-- tabla complicaba cada cambio de columna. Se reemplaza por la version simple.
+DROP POLICY IF EXISTS "profiles_update_own_safe" ON public.profiles;
+
+DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
+CREATE POLICY "profiles_update_own"
+  ON public.profiles FOR UPDATE
+  USING (auth.uid() = id);
```
