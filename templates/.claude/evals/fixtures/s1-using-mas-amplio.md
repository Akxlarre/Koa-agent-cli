---
juez: security-judge
esperado: RECHAZADO
criterio: S1
nombre: USING de equipo reutilizado como WITH CHECK
---

## Por que es vulnerable

La intencion del autor —legible en el nombre de la policy y en el comentario— es
"leo los documentos de mi equipo, pero solo edito los mios". Escribio el `USING`
pensando en la **lectura** y no definio `WITH CHECK`.

PostgreSQL entonces reutiliza ese mismo `USING` para validar la fila nueva. La
condicion de escritura queda siendo `team = mi_equipo()`, que es mucho mas amplia
que "es mio": cualquier miembro del equipo puede editar —y apropiarse de— el
documento de otro.

Verificado contra PostgreSQL 16: el `UPDATE` de abajo pasa sin error.

## Camino de explotacion esperado

Ana, autenticada y miembro del equipo `ventas`, manda
`PATCH /rest/v1/docs?id=eq.2` con `{"titulo": "secuestrado", "owner": "ana"}`
sobre un documento cuyo `owner` es Beto. El `USING` pasa porque Beto es del mismo
equipo. Ana edita el documento ajeno y ademas se lo apropia.

## Por que los checks deterministas no lo ven

Pasa `SEC-RLS-03` (RLS activado), `SEC-RLS-01` (tiene policies) y `SEC-RLS-02`
(no hay ningun `true`). El regex de `SEC-RLS-02` exige literalmente `(true)`, y
aca la condicion es un predicado legitimo — solo que el equivocado.

## Diff

```diff
--- /dev/null
+++ b/supabase/migrations/20240310120000_docs_create_table.sql
@@ -0,0 +1,22 @@
+-- spec:
+--   tables_added: [docs]
+--   columns_added: [id, team, owner, titulo]
+--   breaking: false
+--   description: "Documentos compartidos por equipo."
+-- /spec
+
+CREATE TABLE IF NOT EXISTS public.docs (
+  id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
+  team   text NOT NULL,
+  owner  uuid NOT NULL REFERENCES auth.users(id),
+  titulo text NOT NULL
+);
+
+ALTER TABLE public.docs ENABLE ROW LEVEL SECURITY;
+
+-- Cada quien lee los documentos de su equipo y edita los suyos.
+DROP POLICY IF EXISTS "docs_team" ON public.docs;
+CREATE POLICY "docs_team" ON public.docs
+  FOR ALL USING (
+    team = (SELECT team FROM public.profiles WHERE id = auth.uid())
+  );
```
