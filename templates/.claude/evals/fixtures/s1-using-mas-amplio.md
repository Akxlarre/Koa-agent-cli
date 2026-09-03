---
juez: security-judge
esperado: RECHAZADO
criterio: S1
tambien_valido: [S3]
nombre: USING de household reutilizado como WITH CHECK
---

> **Nota del corpus.** S3 es un encadenado legitimo: el predicado se ancla en
> `profiles.household_id`, y el `WITH CHECK` de `profiles_update_own_safe` congela
> **solo** `role` — asi que el usuario puede reasignarse el household con un PATCH
> a su propio perfil y saltar de grupo. Un juez que lo reporte tiene razon; el que
> **debe** aparecer es S1, que es la causa.

## Por que es vulnerable

La intencion del autor —legible en el nombre de la policy y en el comentario— es
"leo los documentos de mi household, pero solo edito los mios". Escribio el `USING`
pensando en la **lectura** y no definio `WITH CHECK`.

PostgreSQL entonces reutiliza ese mismo `USING` para validar la fila nueva. La
condicion de escritura queda siendo `household_id = mi_household()`, mucho mas
amplia que "es mio": cualquier miembro del household puede editar —y apropiarse
de— el documento de otro. El `FOR ALL` extiende lo mismo a INSERT y DELETE.

Verificado contra PostgreSQL 16: el `UPDATE` de abajo pasa sin error.

## Camino de explotacion esperado

Ana, autenticada y miembro del household `H1`, manda
`PATCH /rest/v1/docs?id=eq.2` con `{"titulo": "secuestrado", "owner": "ana"}`
sobre un documento cuyo `owner` es Beto. El `USING` pasa porque Beto es del mismo
household. Ana edita el documento ajeno y ademas se lo apropia.

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
+--   columns_added: [id, household_id, owner, titulo]
+--   breaking: false
+--   description: "Documentos compartidos por household."
+-- /spec
+
+CREATE TABLE IF NOT EXISTS public.docs (
+  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
+  household_id uuid NOT NULL,
+  owner        uuid NOT NULL REFERENCES auth.users(id),
+  titulo       text NOT NULL
+);
+
+ALTER TABLE public.docs ENABLE ROW LEVEL SECURITY;
+
+-- Cada quien lee los documentos de su household y edita los suyos.
+DROP POLICY IF EXISTS "docs_household" ON public.docs;
+CREATE POLICY "docs_household" ON public.docs
+  FOR ALL USING (
+    household_id = (SELECT household_id FROM public.profiles WHERE id = auth.uid())
+  );
```
