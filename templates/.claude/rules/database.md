---
paths:
  - "supabase/**"
  - "src/app/core/services/supabase*"
  - "src/app/core/services/*facade*"
  - "src/app/core/services/*service*"
---

# Reglas de Base de Datos (Supabase)

## Migraciones

- Todo DDL en `supabase/migrations/`
- Naming: `YYYYMMDDHHMMSS_<dominio>_<tipo>_<descripcion>.sql`
- **NUNCA** alterar la BD desde el Dashboard de Supabase manualmente
- Los scripts deben ser idempotentes (`CREATE TABLE IF NOT EXISTS`, etc.)

## Documentación obligatoria

- Toda tabla nueva → agregar en `indices/DATABASE.md`
- Incluir columnas clave y políticas RLS en la documentación

## RLS (Row Level Security)

- **SIEMPRE** activar RLS en tablas nuevas: `ALTER TABLE x ENABLE ROW LEVEL SECURITY;`
- **SIEMPRE** definir al menos una policy en la misma migración que crea la tabla.
- Documentar cada policy en `indices/DATABASE.md`: quién puede SELECT, INSERT, UPDATE, DELETE
- Usar funciones helper si hay lógica de ownership compleja

### Activar RLS sin policies deja la tabla inaccesible

No es un descuido menor: Postgres **deniega por defecto**. Una tabla con RLS y
cero policies no queda "medio protegida" — queda cerrada para todo el mundo,
incluida tu propia app. El error aparece en runtime, lejos de la migración.

```sql
-- ✗ La tabla existe y nadie —ni tu app— puede leerla
CREATE TABLE public.pedidos (id uuid PRIMARY KEY, user_id uuid);
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

-- ✓ RLS + policy acotada, en la misma migración
CREATE TABLE public.pedidos (id uuid PRIMARY KEY, user_id uuid);
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pedidos_select_own" ON public.pedidos
  FOR SELECT USING (auth.uid() = user_id);
```

### `USING (true)` no es el arreglo

Cuando la app deja de leer la tabla, la tentación es abrirla del todo. Eso pasa de
*inaccesible* a *abierta a cualquier usuario autenticado* en un solo commit, y las
dos versiones compilan igual.

```sql
-- ✗ Cualquiera puede modificar cualquier fila
CREATE POLICY "pedidos_all" ON public.pedidos FOR ALL USING (true);

-- ✗ Sin cláusula FOR, Postgres asume ALL — mismo problema, más difícil de ver
CREATE POLICY "pedidos_all" ON public.pedidos USING (true);

-- ✓ Acotada al dueño
CREATE POLICY "pedidos_update_own" ON public.pedidos
  FOR UPDATE USING (auth.uid() = user_id);

-- ✓ Acotada por rol
CREATE POLICY "pedidos_admin" ON public.pedidos FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
```

`USING (true)` **sí** es defendible en `FOR SELECT` de una tabla de catálogo
pública. Es el único caso.

### Qué te va a bloquear

| Check | Cuándo salta | Dónde |
|---|---|---|
| `SEC-RLS-01` | `CREATE TABLE` sin ninguna `CREATE POLICY` | hook + `npm run lint:arch` |
| `SEC-RLS-02` | `USING (true)` / `WITH CHECK (true)` en ALL/INSERT/UPDATE/DELETE | hook + `npm run lint:arch` |
| `SEC-RLS-03` | Tabla sin RLS activado en ninguna migración | `npm run lint:arch` |

El hook exige el par tabla+policy **en el mismo archivo**. `lint:arch` es más
flexible: mira todas las migraciones juntas y acepta que las policies lleguen en
una posterior. Detalle en `docs/TECH-STACK-RULES.md#sec-rls-01`.

## Realtime

- Servicios con Supabase Realtime → usar RxJS `Observable`
- En la Facade → `toSignal()` para exponer al template
- Cancelar subscripciones en `ngOnDestroy`

## Tipos TypeScript desde Supabase (fuente de verdad)

- Ejecuta `npm run supabase:types` después de cada migración (requiere `supabase start`)
- El archivo `src/app/core/models/supabase.types.ts` es **AUTO-GENERADO** — no editar manualmente
- Las interfaces en `core/models/dto/` deben **extender** de `supabase.types.ts`, no redefinir campos
- El Architect Guard bloqueará ediciones manuales a `supabase.types.ts` (`ARCH-11`)

```typescript
// CORRECTO: extender desde tipos generados
import type { Database } from './supabase.types';
type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export interface ProfileDto extends ProfileRow {
  // campos derivados adicionales aquí
}
```

## Spec Header obligatorio en migraciones

Toda migración nueva debe incluir un bloque spec al inicio del archivo:

```sql
-- spec:
--   tables_added: [nombre_tabla]
--   columns_added: [col1, col2, ...]
--   breaking: false
--   description: "Descripción breve"
-- /spec
```

## Patrón de query

```typescript
// CORRECTO: en un FacadeService o CoreService
const { data, error } = await this.supabase.client
  .from('tabla')
  .select('*')
  .order('created_at', { ascending: false });
```
