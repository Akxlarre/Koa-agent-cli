---
juez: security-judge
esperado: RECHAZADO
criterio: S4
nombre: SECURITY DEFINER sin search_path fijo
---

## Por que es vulnerable

Una funcion `SECURITY DEFINER` corre con los privilegios de quien la creo —el
dueño de la base— y por lo tanto **ignora RLS**. Si ademas no fija `search_path`,
los nombres sin calificar que usa adentro (`profiles`, `now()`) se resuelven
segun el `search_path` de **quien la llama**.

Quien pueda crear objetos en un esquema que aparezca antes en ese `search_path`
puede colocar ahi una tabla o funcion que sombree a la real, y su codigo corre
con los privilegios del definer.

El blueprint ya lo hace bien: `handle_new_user()` en
`20240101000001_auth_rls_role_protection.sql` declara
`SECURITY DEFINER SET search_path = public`. Este diff introduce una funcion
nueva que no sigue ese patron.

## Camino de explotacion esperado

La funcion se declara `SECURITY DEFINER` sin `SET search_path`, y encima devuelve
filas de `profiles` sin filtrar por `auth.uid()`. Cualquier usuario autenticado
llama `POST /rest/v1/rpc/buscar_usuarios` con un termino vacio o `%` y recibe el
padron completo —incluidos `email` y `role` de todos— saltandose por completo las
policies de `profiles`.

## Por que los checks deterministas no lo ven

`architect.js` no escanea `SECURITY DEFINER` en ninguna regla. Y la funcion no
crea tablas ni policies, asi que la auditoria acumulada de `SEC-RLS-01/02/03` ni
la mira.

## Diff

```diff
--- /dev/null
+++ b/supabase/migrations/20240325160000_profiles_buscar_usuarios.sql
@@ -0,0 +1,18 @@
+-- spec:
+--   tables_modified: []
+--   breaking: false
+--   description: "RPC de busqueda de usuarios para el autocomplete de menciones."
+-- /spec
+
+CREATE OR REPLACE FUNCTION public.buscar_usuarios(termino text)
+RETURNS TABLE (id uuid, display_name text, email text, role text)
+LANGUAGE sql
+SECURITY DEFINER
+AS $$
+  SELECT id, display_name, email, role
+  FROM profiles
+  WHERE display_name ILIKE '%' || termino || '%'
+  ORDER BY display_name
+  LIMIT 50;
+$$;
+
+GRANT EXECUTE ON FUNCTION public.buscar_usuarios(text) TO authenticated;
```
