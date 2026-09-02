# Reglas del Tech Stack (Angular v20+, Supabase, Tailwind v4, GSAP)

> **Importante para Agentes:** NUNCA rompas estas reglas de arquitectura.

## ARCH (Deep links del linter)

<a id="arch-01"></a>
### ARCH-01: No Supabase in UI
- Prohibido importar `@supabase/supabase-js` en `src/app/features/**` y `src/app/shared/**`.
- Solución: mover acceso a datos a un `*FacadeService` (o services core) y exponer estado por Signals.

<a id="arch-02"></a>
### ARCH-02: Facade-only injection (en componentes vista)
- Prohibido inyectar `*Service` directo en `*.component.ts` de `features/` y `shared/` (excepto servicios de infraestructura explícitos).
- Solución: inyecta un `*FacadeService` y deja los services internos en `core/`.

<a id="arch-03"></a>
### ARCH-03: TDD required (core)
- Todo `*.facade.ts` y `*.service.ts` en `src/app/core/**` debe tener su `*.spec.ts`.

<a id="arch-04"></a>
### ARCH-04: OnPush required
- Todo componente debe usar `ChangeDetectionStrategy.OnPush`.

<a id="arch-05"></a>
### ARCH-05: No `@angular/animations`
- Prohibido importar `@angular/animations*`.
- Solución: usar **GSAP** vía `GsapAnimationsService`.

<a id="arch-06"></a>
### ARCH-06: No legacy template directives
- Prohibido `*ngIf`, `*ngFor`, `[ngClass]`, `[ngStyle]`.
- Solución: `@if/@for` y bindings directos `[class.x]`, `[style.prop]`.

<a id="arch-07"></a>
### ARCH-07: No `@keyframes` en estilos de componente
- Prohibido `@keyframes` en estilos dentro de `src/app/**`.
- **`src/styles/` está fuera de alcance, y es a propósito.** Ahí vive la capa de motion curada del design system: `_animations.scss`, `motion/_view-transitions.scss` (las view transitions no se pueden hacer con GSAP) y los overrides de PrimeNG. El blueprint reparte siete `@keyframes` en esa capa y ninguno es una violación.
- Lo que la regla prohíbe es la animación **ad-hoc en un componente**, que es lo que `GsapAnimationsService` existe para reemplazar.
- Solución: usar GSAP, o una de las clases de motion del DS (`.animate-fade-in-up`, `.indicator-live`, `.badge-pulse`).

<a id="arch-08"></a>
### ARCH-08: No hardcoded Tailwind colors
- Prohibido `text-red-500`, `bg-blue-200`, etc. en `.ts` y `.html`.
- Solución: tokens semánticos (`text-primary`, `text-muted`, `bg-surface`, `bg-canvas`, `var(--ds-brand)`).

<a id="arch-09"></a>
### ARCH-09: Complexity warning (shared components)
- Warning si un `shared/**/*.component.ts` tiene una clase muy grande (recomendación: \(\le 200\) líneas de **cuerpo**: del primer miembro al último).
- El `@Component` **no cuenta**: el template y los estilos inline son markup, no complejidad de la clase. La regla medía el span completo de la declaración —decoradores incluidos, que es como los guarda el AST de TypeScript— y con template inline eso denunciaba componentes de 48 líneas por tener 298 (`INC-008`). Cuando el decorador pesa más que la clase, el aviso lo aclara.
- Solución: dividir en subcomponentes, extraer helpers y mantener `shared/` como UI presentacional.

<a id="arch-10"></a>
### ARCH-10: Complexity warning (facades)
- Warning si un `*.facade.ts` es demasiado complejo (recomendación: \(\le 5\) `inject()` y métodos \(\le 50\) líneas).
- Solución: extraer lógica a services/helpers y mantener la Facade como orquestador de estado/errores.

<a id="arch-12"></a>
### ARCH-12: Repository boundary
- Prohibido llamar `.db.from()` o `.client.from()` dentro de un Facade.
- Solución: crear o reutilizar un Repository en `core/repositories/` e inyectarlo.
- Cadena canónica: `UI → Facade → Repository → SupabaseService.db`.
- Por qué: el getter `.db` existe solo para Repositories. Si el Facade consulta directo, la forma del cliente Supabase se filtra hacia arriba y cambiar de proveedor pasa a tocar toda la app.

<a id="arch-13"></a>
### ARCH-13: `supabase.types.ts` es auto-generado
- Prohibido editar `src/app/core/models/supabase.types.ts` a mano.
- Solución: `npm run supabase:types` lo regenera. Las interfaces de `dto/` deben **extender** de ahí, no duplicar sus campos.
- Por qué: cualquier edición manual se pierde en la próxima regeneración, y el tipo deja de reflejar el esquema real.

<a id="arch-27"></a>
### ARCH-27: Decoradores `@Input()` / `@Output()`
- Prohibido `@Input()` y `@Output()` en componentes nuevos.
- Solución: las APIs de signals — `input()`, `input.required()`, `output()`.
- Por qué: un `@Input()` no es reactivo por sí solo y obliga a `ngOnChanges` o a un setter para derivar estado; `input()` es un signal y `computed()` se encadena solo.
- Lo emite `pre-write-guard` (regex sobre el contenido nuevo).

<a id="arch-28"></a>
### ARCH-28: `MessageService` de PrimeNG inyectado directo
- Prohibido `inject(MessageService)` en un `*.component.ts` de `features/`, `shared/` o `layout/`.
- Solución: `ToastService` (`core/services/toast.service.ts`).
- Por qué: los toasts efímeros son una decisión de producto (duración, severidad, copy) y con `MessageService` directo cada componente la toma por su cuenta. Ver `.claude/rules/notifications.md`.
- Lo emite `pre-write-guard`.

<a id="sql-01"></a>
### SQL-01: Nombre de migración fuera de convención
- Formato obligatorio: `YYYYMMDDHHMMSS_<dominio>_<tipo>_<descripcion>.sql`.
- Por qué: el orden de aplicación de las migraciones es el orden alfabético de sus nombres. Un nombre sin timestamp se aplica en un punto impredecible de la secuencia.
- Lo emite `pre-write-guard` al crear el archivo (`Write`).

<a id="sec-env-01"></a>
### SEC-ENV-01: Credencial real en un environment file
- Prohibido escribir un JWT de Supabase (`eyJ…`) o una URL de proyecto real en `src/environments/**`.
- Solución: variables de entorno + `scripts/set-env.js`, que las inyecta en build.
- Por qué: `environment.ts` se commitea. Un placeholder (`your-anon-key-here`) no dispara la regla; un JWT de verdad sí.
- Lo emite `pre-write-guard`.

<a id="a11y-01"></a>
### A11Y-01: `<app-icon>` sin `aria-label`
- Un icono de acción sin etiqueta es invisible para un lector de pantalla.
- Solución: `[attr.aria-label]="'Descripción'"`. Si hay texto hermano visible que ya lo describe, `ariaHidden="true"`.

<a id="a11y-02"></a>
### A11Y-02: `<p-table>` sin `aria-label` ni caption
- Solución: `[attr.aria-label]="'Nombre de la tabla'"` o `pTemplate="caption"`.

<a id="llm-01"></a>
### LLM-01: Botón `type="submit"` sin `data-llm-action`
- Los formularios son puntos de mutación críticos. Un agente que lee el template necesita saber qué acción dispara el botón.
- Solución: `<button type="submit" data-llm-action="crear-producto">`.

<a id="llm-02"></a>
### LLM-02: Botón destructivo sin `data-llm-action`
- Aplica a botones cuyo `aria-label` indica eliminar/borrar/remove.
- Solución: `<button aria-label="Eliminar producto" data-llm-action="delete-producto">`.

<a id="sec-rls-01"></a>
### SEC-RLS-01: Tabla creada sin políticas RLS
- Una tabla con RLS activado y **cero políticas** no es segura: es **inaccesible**. Postgres deniega por defecto, así que ni tu propia app puede leerla.
- El síntoma llega en runtime, lejos de la migración que lo causó.
- Solución: al menos una política por operación necesaria, acotada al dueño del dato o al rol.
- El hook exige el par tabla+política **en el mismo archivo** (la convención del blueprint). `lint:arch` es más flexible: mira todas las migraciones y acepta que las políticas lleguen en una posterior.

<a id="sec-rls-02"></a>
### SEC-RLS-02: Política permisiva sobre una escritura
- Prohibido `USING (true)` / `WITH CHECK (true)` en `FOR ALL`, `INSERT`, `UPDATE` o `DELETE`.
- **Sin cláusula `FOR`, Postgres asume `ALL`** — el caso más permisivo, y el más fácil de escribir por accidente.
- Solución: `USING (auth.uid() = user_id)` o una condición por rol.
- `FOR SELECT USING (true)` **sí** está permitido: una tabla de catálogo pública es legítima, y es la única forma en que `true` se defiende.
- Por qué importa junto a SEC-RLS-01: el arreglo natural de "la tabla está bloqueada" es abrirla del todo. Se pasa de inaccesible a totalmente abierta en un commit, y ambos extremos compilan.

<a id="sec-rls-03"></a>
### SEC-RLS-03: Tabla sin RLS activado
- Solo lo reporta `lint:arch`, que ve todas las migraciones juntas.
- Solución: `ALTER TABLE public.tabla ENABLE ROW LEVEL SECURITY;`

## 1. Patrones de Diseño Arquitectónico Obligatorios

### A. Patrón Facade Estricto
- **NUNCA** inyectes `SupabaseService`, `HttpClient`, o referencias directas a bases de datos en los Componentes UI (`*.component.ts`).
- **SIEMPRE** usa un Patrón Facade: La UI llama a un `*FacadeService` y éste delega en la red. El Facade expone el estado global vía Signals.

### B. Smart vs Dumb Components (Atomic Design)
- **Dumb Components (`shared/`):** El 90% de tu UI. Solo reciben data por `input()` y emiten eventos por `output()`. No saben de dónde viene la data. (Ej: `kpi-card`).
- **Smart Components (`features/`):** Tienen inyectado el Facade. Son responsables de coordinar los Dumb Components pasando states/Signals. Son las "Páginas".
- **Skeletons Colocated:** Todo Dumb component que reciba data asíncrona debe tener su `{componente}-skeleton.component.ts` al lado de él que mantenga EXACTAMENTE el mismo layout y proporciones del grid.

### C. Tipados y Manejo de Errores (State & Error Handling)
- **Ubicación de Interfaces:** Los types e interfaces globales deben situarse en `core/models/`. Los modelos específicos de un feature o servicio van junto a su ecosistema (ej. el Facade), **NUNCA** esparcidos o creados al vuelo dentro de los componentes.
- **Gestión de Errores:** Al manejar suscripciones o llamadas a red (Supabase/REST) en el Facade, utiliza `catchError`. Transforma las fallas en un estado seguro para la UI explayando un `Signal` de error (`errorSignal`) o delegando a un servicio centralizado de notificación (Toasts), evitando que los errores rompan la UI silenciosamente.

## 2. Reactividad & Angular v20+ Signals
- **`ChangeDetectionStrategy.OnPush`** es OBLIGATORIO en TODO componente creado.
- **Estado UI (Sincrónico):** Usa `signal()` para contadores, modales abiertos, etc.
- **Flujos Async / Red:** Usa `RxJS` internamente en los servicios. En el nivel de la Facade, usa la función `toSignal()` para exponer los flujos a tu HTML.
- **Templates:** Prohibido usar `*ngIf` o `*ngFor`. Usa obligatoriamente el Control Flow nativo: `@if` y `@for`.
- **Inputs:** Migra `@Input()` y `@Output()` hacia las nuevas APIs de Signals (`input()`, `output()`).
- No uses `ngClass` o `ngStyle`, usa binding directo: `[class.active]="isActive()"` o `[style.width.px]="width()"`.

## 3. Jerarquía Visual (Design System -> PrimeNG -> Custom)
Antes de crear un componente presentacional, consulta en este orden:
1. `indices/COMPONENTS.md`: ¿El Boilerplate (Design System local) tiene algo aplicable? Si la respuesta es sí, úsalo.
2. `PrimeNG`: En inputs de data, dropdowns complejos, calendarios, usa `p-dropdown`, `p-calendar` etc. (Ver [PrimeNG Priority Rule](../skills/primeng-priority.md)).
3. Componente Custom: Solo escríbelo si los pasos 1 y 2 no cubrieron la necesidad.

<a id="database"></a>

## 4. Base de Datos & Base de Trabajo (Supabase Migrations)
- Todo esquema DDL va en la carpeta `supabase/migrations/` (Naming convention: `YYYYMMDDHHMMSS_<dominio>_<tipo>_<descripcion>.sql`).
- SIEMPRE documentar en `indices/DATABASE.md` cada nueva tabla y su política de Row Level Security (RLS).
- Si usas Supabase realtime, actualiza tus servicios usando RxJS `Observable` -> `toSignal()`.

## 5. Estilos & Motion (Tailwind v4 + SCSS + View Transitions)
- **Tailwind v4:** Usar de forma predeterminada para el 90% del styling (utilidades como `p-4`, `flex`, `bg-surface`, `text-text-muted`). NUNCA usar colores Tailwind arbitrarios. TODO debe mapear a nuestros tokens de diseño.
- **Vanilla SCSS:** Usar EXCLUSIVAMENTE para layouts complejos estructurales (ej: los mixins abstractos del `_bento-grid.scss`) o donde las utilidades de Tailwind se vuelvan ilegibles.
- **Motion:**
  - Navegación de rutas → **CSS View Transitions API** nativa (`_view-transitions.scss`).
  - Animación de componentes montados → **GSAP** (`GsapAnimationsService`). NO uses `@keyframes` para micro-interacciones complejas.
  - Cambio de Tema (Light/Dark) → **CSS Transitions** puros (manejados globalmente en el `body`).
