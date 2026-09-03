/**
 * lib/guard-rules.js — Las reglas que emite el GUARD, como datos.
 *
 * HUE-012 e INC-001, que son el mismo problema visto desde dos lados.
 *
 * `pre-write-guard` empuja 25 violaciones y **solo seis decían su nombre**
 * (`ARCH-12`, `ARCH-13`, `A11Y-01/02`, `LLM-01/02`). Las otras diecinueve
 * bloqueaban una escritura con una frase y nada más — y varias de ellas YA
 * estaban documentadas con ID en `docs/TECH-STACK-RULES.md`:
 *
 *     el guard dice          el doc lo llama
 *     ─────────────────────  ───────────────
 *     «Usa @if en vez de…»   ARCH-06
 *     «Falta OnPush»         ARCH-04
 *     «No @angular/animations» ARCH-05
 *     «colores hardcodeados» ARCH-08
 *
 * Una regla sin nombre no se puede provocar, ni contar, ni cruzar contra la
 * documentación: `provocar-reglas.mjs` audita `architect.js` porque sus reglas
 * se anuncian, y el guard quedaba fuera por no anunciarse.
 *
 * **El ID es de la REGLA, no de quien la implementa.** `ARCH-12` y `ARCH-13`
 * siempre vivieron acá y no en `architect.js`; eso no las hace de otro
 * namespace. Lo que faltaba —y es lo que INC-001 pedía— era un registro que
 * diga quién emite qué. Este archivo lo es para el guard; `RULES` en
 * `architect.js` lo es para el linter.
 *
 * Micro-suite: `node --test .claude/tests/guard-rules.test.js`
 */

/**
 * Cada entrada: qué detecta, dónde se documenta, y el fixture que la provoca.
 *
 * `fixture` es el archivo más chico que la viola: `ruta` relativa al proyecto y
 * `contenido`. Es lo que hace auditable la pregunta «¿esta regla puede fallar?».
 * Chico a propósito — si un fixture viola tres reglas, no se sabe cuál disparó.
 */
const GUARD_RULES = {
  'ARCH-06': {
    que: 'Directivas de template legacy: *ngIf, *ngFor, [ngClass], [ngStyle]',
    doc: 'docs/TECH-STACK-RULES.md#arch-06',
    fixture: {
      ruta: 'src/app/features/x/x.component.html',
      contenido: '<div *ngIf="cond">x</div>',
    },
  },

  'ARCH-27': {
    que: 'Decoradores @Input()/@Output() en vez de las APIs de signals',
    doc: 'docs/TECH-STACK-RULES.md#arch-27',
    fixture: {
      ruta: 'src/app/features/x/x.component.ts',
      contenido: '@Input() public valor: string;',
    },
  },

  'ARCH-13': {
    que: 'Edición manual de supabase.types.ts, que es auto-generado',
    doc: 'docs/TECH-STACK-RULES.md#arch-13',
    fixture: {
      ruta: 'src/app/core/models/supabase.types.ts',
      contenido: 'export interface Database { public: {} }',
    },
  },

  'ARCH-01': {
    que: 'Import de @supabase/supabase-js en la capa UI (features/, shared/)',
    doc: 'docs/TECH-STACK-RULES.md#arch-01',
    fixture: {
      ruta: 'src/app/features/x/x.component.ts',
      contenido: "import { createClient } from '@supabase/supabase-js';",
    },
  },

  'ARCH-05': {
    que: 'Import de @angular/animations (el proyecto anima con GSAP)',
    doc: 'docs/TECH-STACK-RULES.md#arch-05',
    fixture: {
      ruta: 'src/app/features/x/x.component.ts',
      contenido: "import { trigger } from '@angular/animations';",
    },
  },

  'ARCH-04': {
    que: 'Componente sin changeDetection: OnPush',
    doc: 'docs/TECH-STACK-RULES.md#arch-04',
    fixture: {
      ruta: 'src/app/features/x/x.component.ts',
      contenido: "@Component({ selector: 'app-x', template: '<p>x</p>' })\nexport class XComponent {}",
      tool: 'Write',
    },
  },

  'ARCH-08': {
    que: 'Colores Tailwind hardcodeados en .ts/.html y en .scss',
    doc: 'docs/TECH-STACK-RULES.md#arch-08',
    fixture: {
      ruta: 'src/app/features/x/x.component.html',
      contenido: '<div class="text-red-500">x</div>',
    },
  },

  'ARCH-02': {
    que: 'Componente Dumb de shared/ inyectando un Facade',
    doc: 'docs/TECH-STACK-RULES.md#arch-02',
    fixture: {
      ruta: 'src/app/shared/ui/kpi/kpi.component.ts',
      contenido: 'readonly facade = inject(AuthFacade);',
    },
  },

  'ARCH-28': {
    que: 'MessageService de PrimeNG inyectado directo en un componente',
    doc: 'docs/TECH-STACK-RULES.md#arch-28',
    fixture: {
      ruta: 'src/app/features/x/x.component.ts',
      contenido: 'private readonly msg = inject(MessageService);',
    },
  },

  'ARCH-12': {
    que: 'Un Facade llamando .db.from() o .client.from() en vez de un Repository',
    doc: 'docs/TECH-STACK-RULES.md#arch-12',
    fixture: {
      ruta: 'src/app/core/facades/x.facade.ts',
      contenido: 'const { data } = await this.db.from("tabla").select();',
    },
  },

  'LLM-01': {
    que: 'Botón type="submit" sin data-llm-action',
    doc: 'docs/TECH-STACK-RULES.md#llm-01',
    fixture: {
      ruta: 'src/app/features/x/x.component.html',
      contenido: '<button type="submit">Guardar</button>',
    },
  },

  'LLM-02': {
    que: 'Botón destructivo sin data-llm-action',
    doc: 'docs/TECH-STACK-RULES.md#llm-02',
    fixture: {
      // El detector busca `aria-label` con una palabra de borrado, no el texto
      // del botón: un `<button>Eliminar</button>` NO lo dispara. Lo dijo el
      // fixture al fallar, que es para lo que sirve escribirlos.
      ruta: 'src/app/features/x/x.component.html',
      contenido: '<button aria-label="Eliminar producto">x</button>',
    },
  },

  'A11Y-01': {
    que: '<app-icon> sin aria-label',
    doc: 'docs/TECH-STACK-RULES.md#a11y-01',
    fixture: {
      ruta: 'src/app/features/x/x.component.html',
      contenido: '<app-icon name="trash" />',
    },
  },

  'A11Y-02': {
    que: '<p-table> sin aria-label ni caption',
    doc: 'docs/TECH-STACK-RULES.md#a11y-02',
    fixture: {
      ruta: 'src/app/features/x/x.component.html',
      contenido: '<p-table [value]="filas"></p-table>',
    },
  },

  'ARCH-07': {
    que: '@keyframes en estilos de componente',
    doc: 'docs/TECH-STACK-RULES.md#arch-07',
    fixture: {
      ruta: 'src/app/features/x/x.component.scss',
      contenido: '@keyframes fadeIn { from { opacity: 0 } }',
    },
  },

  'SEC-ENV-01': {
    que: 'Credencial de Supabase escrita en un environment file',
    doc: 'docs/TECH-STACK-RULES.md#sec-env-01',
    fixture: {
      // Un JWT de verdad: el detector exige dos segmentos de 20+ chars, para no
      // marcar los placeholders («your-anon-key-here») que el blueprint reparte.
      ruta: 'src/environments/environment.ts',
      contenido: 'export const environment = { supabaseKey: '
        + '"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IngifQ.abc" };',
    },
  },

  // ── Las de migraciones. El guard mira UN archivo al escribirlo; architect.js
  // mira el estado ACUMULADO de supabase/migrations/. Los dos emiten SEC-RLS-01
  // y -02 con criterios distintos y complementarios, y por eso el ID es de la
  // regla y no de quien la implementa (INC-001).
  'SQL-01': {
    que: 'Nombre de migración fuera del formato YYYYMMDDHHMMSS_dominio_tipo.sql',
    doc: 'docs/TECH-STACK-RULES.md#sql-01',
    fixture: {
      ruta: 'supabase/migrations/crear_tabla.sql',
      contenido: 'SELECT 1;',
      tool: 'Write',
    },
  },

  'SEC-RLS-03': {
    que: 'CREATE TABLE sin ENABLE ROW LEVEL SECURITY en la misma migración',
    doc: 'docs/TECH-STACK-RULES.md#sec-rls-03',
    fixture: {
      ruta: 'supabase/migrations/20260101000000_notas_create.sql',
      contenido: 'CREATE TABLE public.notas (id uuid PRIMARY KEY);',
    },
  },

  'SEC-RLS-01': {
    que: 'Tabla con RLS activado y ninguna política: inaccesible para todos',
    doc: 'docs/TECH-STACK-RULES.md#sec-rls-01',
    fixture: {
      ruta: 'supabase/migrations/20260101000000_notas_create.sql',
      contenido: 'CREATE TABLE public.notas (id uuid PRIMARY KEY);\n'
        + 'ALTER TABLE public.notas ENABLE ROW LEVEL SECURITY;',
    },
  },

  'SEC-RLS-02': {
    que: 'Política de escritura con condición `true`',
    doc: 'docs/TECH-STACK-RULES.md#sec-rls-02',
    fixture: {
      ruta: 'supabase/migrations/20260101000000_notas_policy.sql',
      contenido: 'CREATE TABLE public.notas (id uuid PRIMARY KEY);\n'
        + 'ALTER TABLE public.notas ENABLE ROW LEVEL SECURITY;\n'
        + 'CREATE POLICY notas_w ON public.notas FOR UPDATE USING (true);',
    },
  },
};

/** Los IDs que el guard puede emitir. */
function ids() {
  return Object.keys(GUARD_RULES);
}

/** ¿La salida nombra esta regla? Con corchetes, igual que en el linter. */
function disparo(salida, ruleId) {
  return String(salida).includes(`[${ruleId}]`);
}

/**
 * Reglas registradas que NO tienen fixture.
 *
 * Existe para que el registro no pueda mentir por omisión: agregar una regla y
 * no escribir su fixture es lo que este chequeo tiene que ver.
 */
function sinFixture() {
  return ids().filter((id) => !GUARD_RULES[id].fixture?.contenido);
}

module.exports = { GUARD_RULES, ids, disparo, sinFixture };
