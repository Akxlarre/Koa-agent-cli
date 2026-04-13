<!-- spec-version: {{GENERATED_AT}} -->
<!-- auto-refresh: indices:sync -->

# Registro de Base de Datos (Supabase)

> **Regla de Actualización (OBLIGATORIA):** El Agente DEBE usar sus herramientas de escritura de archivos para definir nuevas tablas en la lista de abajo cada vez que genere migraciones en `supabase/migrations/`. La documentación del RLS y FDs debe ser estricta.
>
> **Spec Header en migraciones:** Toda migración nueva DEBE incluir un bloque de especificación al inicio:
> ```sql
> -- spec:
> --   tables_added: [nombre_tabla]
> --   columns_added: [col1, col2, ...]
> --   breaking: false
> --   description: "Descripción breve"
> -- /spec
> ```
> Este header es la fuente de verdad legible por el agente — permite entender el contrato de la migración sin parsear el SQL completo.

| Tabla / Colección | Core / Dominio | Columnas Clave | Relaciones (FKs) | Restricciones RLS (Policies) | Estado |
|-------------------|----------------|----------------|------------------|------------------------------|--------|
| `profiles` | Auth | `id`, `household_id` | N/A (id vinculada a `auth.users`) | `SELECT` public, `UPDATE` own id | ✅ Estable |
