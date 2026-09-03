---
juez: security-judge
esperado: APROBADO
criterio: "-"
nombre: TRAMPA — USING (true) legitimo en catalogo publico
---

## Por que es correcto

`USING (true)` dispara todas las alarmas de pattern-matching, y aca es la unica
forma correcta de escribir la policy.

`database.md` lo dice explicitamente: *"`USING (true)` **si** es defendible en
`FOR SELECT` de una tabla de catalogo publica. Es el unico caso."* Los propios
checks deterministas lo respetan — `SEC-RLS-02` salta el comando `SELECT` a
proposito.

Esta tabla es un catalogo de categorias: contenido publico, sin datos de usuario,
sin columna de ownership. La escritura queda cerrada (no hay policy de
INSERT/UPDATE/DELETE, y con RLS activo eso deniega por defecto).

## Que se evalua aca

Distinguir `FOR SELECT USING (true)` sobre un catalogo de `FOR ALL USING (true)`
sobre datos de usuario. Un juez que los confunde no esta razonando sobre el
modelo de datos: esta buscando la cadena `true`.

## Diff

```diff
--- /dev/null
+++ b/supabase/migrations/20240322100000_categorias_create_table.sql
@@ -0,0 +1,20 @@
+-- spec:
+--   tables_added: [categorias]
+--   columns_added: [id, slug, nombre, orden]
+--   breaking: false
+--   description: "Catalogo publico de categorias. Solo lectura desde el cliente."
+-- /spec
+
+CREATE TABLE IF NOT EXISTS public.categorias (
+  id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
+  slug   text NOT NULL UNIQUE,
+  nombre text NOT NULL,
+  orden  int  NOT NULL DEFAULT 0
+);
+
+ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
+
+-- Catalogo publico: cualquiera lo lee. La escritura queda cerrada por ausencia
+-- de policy — se administra desde el backend con service_role.
+DROP POLICY IF EXISTS "categorias_select_public" ON public.categorias;
+CREATE POLICY "categorias_select_public" ON public.categorias
+  FOR SELECT USING (true);
```
