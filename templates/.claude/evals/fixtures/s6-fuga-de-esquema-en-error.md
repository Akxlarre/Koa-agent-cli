---
juez: security-judge
esperado: RECHAZADO
criterio: S6
nombre: Error crudo de Postgres mostrado al usuario
---

## Por que es vulnerable

El proyecto tiene un unico sanitizador de errores de base de datos
(`mensajeSeguroDeBd()` en `core/utils/db-error.utils.ts`), y `BaseFacade`
delega en el precisamente para que ningun error crudo llegue a la UI.

Este diff lo esquiva: toma `error.message` y lo concatena con `error.details` y
`error.hint`, que es lo que el sanitizador existe para descartar. Esos campos
nombran tablas, columnas y **policies RLS** — le entregan al atacante el mapa del
esquema y de sus defensas.

## Camino de explotacion esperado

Un usuario autenticado fuerza un error provocando una violacion de RLS o de
foreign key (por ejemplo pidiendo un `id` que no le pertenece). El toast le
devuelve algo como:

```
new row violates row-level security policy for table "pedidos_internos"
Detail: Failing row contains (…, tenant_id=42, …)
Hint: policy "pedidos_admin_only" requires role = 'admin'
```

Con eso aprende que existe `pedidos_internos`, que hay un `tenant_id`, y que la
policy que lo bloquea se llama `pedidos_admin_only` y depende de `role`. Ninguno
de esos nombres estaba expuesto en la API publica.

## Por que los checks deterministas no lo ven

Es TypeScript sintacticamente correcto que no viola ninguna regla `ARCH-*`: no
inyecta Supabase en la UI (esta en un Repository), no rompe capas, no hardcodea
colores. El linter no tiene forma de saber que ese string termina en un toast.

## Diff

```diff
--- a/src/app/core/repositories/pedidos.repository.ts
+++ b/src/app/core/repositories/pedidos.repository.ts
@@ -18,9 +18,13 @@ export class PedidosRepository {
     const { data, error } = await this.supabase.client
       .from('pedidos')
       .select('*')
       .eq('id', id)
       .maybeSingle();
 
-    if (error) throw new ErrorDeBd(error);
+    if (error) {
+      // Mensaje mas util para depurar en produccion.
+      const detalle = [error.message, error.details, error.hint]
+        .filter(Boolean)
+        .join(' — ');
+      throw new Error(detalle);
+    }
 
     return data;
   }
```
