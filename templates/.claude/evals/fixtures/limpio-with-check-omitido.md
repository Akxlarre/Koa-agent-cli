---
juez: security-judge
esperado: APROBADO
criterio: "-"
nombre: TRAMPA — WITH CHECK omitido donde USING ya alcanza
---

## Por que es correcto

Esta es la trampa principal del corpus, y existe porque es el falso positivo mas
facil de cometer: **la policy no define `WITH CHECK` y aun asi es segura**.

Cuando `WITH CHECK` no esta, PostgreSQL reutiliza la expresion `USING` para
validar la fila nueva. Aca el `USING` es `auth.uid() = user_id`, que es
exactamente la restriccion de escritura que hace falta: no podes traerte una fila
ajena (no la ves) ni empujar la tuya a otro dueño (la fila resultante ya no
cumpliria el predicado).

Verificado contra PostgreSQL 16:

```
UPDATE pedidos SET user_id = 'beto' WHERE id = 1;
ERROR:  new row violates row-level security policy for table "pedidos"
```

## Que se evalua aca

Un juez que reporte "falta `WITH CHECK`" sobre este diff esta produciendo ruido.
La pregunta correcta no es *¿falta `WITH CHECK`?* sino *¿el `USING` describe
exactamente lo que el usuario deberia poder escribir?* — y aca si lo describe.

Un auditor que rechaza esto rechazaria tambien la mitad de las migraciones
correctas del proyecto, y el equipo aprenderia a ignorarlo.

## Diff

```diff
--- /dev/null
+++ b/supabase/migrations/20240320140000_pedidos_create_table.sql
@@ -0,0 +1,24 @@
+-- spec:
+--   tables_added: [pedidos]
+--   columns_added: [id, user_id, total, created_at]
+--   breaking: false
+--   description: "Pedidos, cada usuario ve y edita los suyos."
+-- /spec
+
+CREATE TABLE IF NOT EXISTS public.pedidos (
+  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
+  user_id    uuid NOT NULL REFERENCES auth.users(id),
+  total      numeric NOT NULL DEFAULT 0,
+  created_at timestamptz NOT NULL DEFAULT now()
+);
+
+ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
+
+DROP POLICY IF EXISTS "pedidos_select_own" ON public.pedidos;
+CREATE POLICY "pedidos_select_own" ON public.pedidos
+  FOR SELECT USING (auth.uid() = user_id);
+
+DROP POLICY IF EXISTS "pedidos_update_own" ON public.pedidos;
+CREATE POLICY "pedidos_update_own" ON public.pedidos
+  FOR UPDATE USING (auth.uid() = user_id);
```
