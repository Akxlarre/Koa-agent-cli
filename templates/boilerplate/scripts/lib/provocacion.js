/**
 * Provocación de reglas — ¿cada regla del linter puede fallar?
 *
 * `rule-wiring.js` ya comprueba que toda regla registrada esté **cableada**: que
 * exista código que la reporte. Esto es el paso siguiente y es distinto: que ese
 * código, puesto delante de una violación real, efectivamente dispare.
 *
 * La diferencia no es teórica. ARCH-26 vivió con su detector escrito, sus tests
 * en verde y ningún llamador — pasaba el cableado por otro camino y no auditaba
 * nada. Una regla que nunca se pudo hacer fallar es decoración: da la sensación
 * de estar protegido, que es peor que saberse desprotegido.
 *
 * El mecanismo es un sandbox: se arma un proyecto mínimo con UN archivo que
 * viola la regla, se corre el linter con `cwd` ahí, y se exige que su salida
 * nombre la regla. El linter no necesita cambios — ya lee de `process.cwd()`.
 *
 * Las reglas sin fixture no hacen fallar esto: quedan en un baseline que **sólo
 * puede achicarse**. Exigir 25 fixtures el primer día garantizaría que alguien
 * desactive el chequeo entero.
 */

/**
 * Un fixture es el archivo más chico que viola la regla.
 *
 * Chico a propósito: si un fixture viola tres reglas, no se sabe cuál disparó, y
 * el día que una se rompa las otras dos la tapan.
 *
 * `ruta` es relativa a la raíz del sandbox. Algunas reglas no se pueden violar
 * con un archivo solo —ARCH-11 compara el uso de una clase contra el `@theme`,
 * que vive en otro archivo—, así que un fixture puede declarar `archivos: []`
 * en vez de `ruta`/`contenido`. `archivosDe()` normaliza las dos formas.
 */
export const FIXTURES = {
  'ARCH-01': {
    ruta: 'src/app/features/fixture.component.ts',
    contenido: `import { ChangeDetectionStrategy, Component } from '@angular/core';
import { createClient } from '@supabase/supabase-js';

@Component({
  selector: 'app-fixture',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<p>x</p>',
})
export class FixtureComponent {
  // Supabase en la UI: eso es lo que ARCH-01 prohíbe.
  private cliente = createClient('http://x', 'y');
}
`,
  },

  'ARCH-04': {
    ruta: 'src/app/features/fixture.component.ts',
    contenido: `import { Component } from '@angular/core';

// Sin changeDetection: OnPush.
@Component({
  selector: 'app-fixture',
  standalone: true,
  template: '<p>x</p>',
})
export class FixtureComponent {}
`,
  },

  'ARCH-03': {
    // Lógica core sin su .spec.ts al lado.
    ruta: 'src/app/core/services/fixture.service.ts',
    contenido: `import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class FixtureService {
  hacerAlgo(): number { return 1; }
}
`,
  },

  'ARCH-05': {
    ruta: 'src/app/features/fixture.component.ts',
    contenido: `import { ChangeDetectionStrategy, Component } from '@angular/core';
import { trigger } from '@angular/animations';

@Component({
  selector: 'app-fixture',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [trigger('x', [])],
  template: '<p>x</p>',
})
export class FixtureComponent {}
`,
  },

  // ── Las once que desbloquean el recorte de visual-system.md (ADR-005 §1) ────
  //
  // No están acá por ser las más fáciles. Son las once cuya prosa en
  // `rules/visual-system.md` querríamos cambiar por el mensaje de error del
  // linter — 4.854 chars que se inyectan en cada edición de un template. Ese
  // cambio no se puede hacer mientras la detección no esté probada: cambiar
  // prevención por detección sin probar la detección apaga el guardrail y deja
  // la sensación de que sigue ahí.

  'ARCH-11': {
    // La clase muerta y el @theme que la desmiente viven en archivos distintos:
    // `brand-weak` no es un token, y `brand` sí es vocabulario del DS — que es
    // justo lo que hace que la clase parezca válida al leerla.
    archivos: [
      {
        ruta: 'src/tailwind.css',
        contenido: `@theme {\n  --color-brand-strong: #123456;\n}\n`,
      },
      {
        ruta: 'src/app/features/fixture.html',
        contenido: `<p class="text-brand-weak">Tailwind no genera CSS para esta clase.</p>\n`,
      },
    ],
  },

  'ARCH-15': {
    // rounded-full + micro-texto + padding horizontal: un badge recompuesto.
    ruta: 'src/app/features/fixture.html',
    contenido: `<span class="rounded-full text-xs px-2">Activo</span>\n`,
  },

  'ARCH-16': {
    // px- sobre un .btn-*: mutila el contrato de tamaño del componente.
    ruta: 'src/app/features/fixture.html',
    contenido: `<button class="btn-primary px-4">Guardar</button>\n`,
  },

  'ARCH-17': {
    ruta: 'src/app/features/fixture.html',
    contenido: `<p class="text-[13px]">Fuera de la escala tipográfica.</p>\n`,
  },

  'ARCH-19': {
    // El cluster del overline escrito a mano, en vez de .micro-label.
    ruta: 'src/app/features/fixture.html',
    contenido: `<p class="uppercase text-text-muted text-xs">Resumen</p>\n`,
  },

  'ARCH-18': {
    // Alias bare dentro del propio @theme: resucita una clase declarada muerta.
    ruta: 'src/tailwind.css',
    contenido: `@theme {\n  --color-brand: #123456;\n  --color-secondary: var(--text-secondary);\n}\n`,
  },

  'ARCH-22': {
    // `.grid` es también una utilidad nativa de Tailwind: las dos reglas se
    // suman en vez de reemplazarse. Es el caso de `.overline` (fix-115-b).
    ruta: 'src/styles/tokens/_variables.scss',
    contenido: `.grid {\n  display: block;\n}\n`,
  },

  'ARCH-23': {
    // En un grid --fill-screen toda celda ocupa UNA fila; .bento-hero ocupa dos.
    ruta: 'src/app/features/fixture.html',
    contenido: `<div class="bento-grid--fill-screen">\n  <div class="bento-hero">Desborda el template explícito.</div>\n</div>\n`,
  },

  'ARCH-24': {
    // Borde + fondo + padding + radio sobre un campo: .field-input a mano.
    ruta: 'src/app/features/fixture.html',
    contenido: `<input class="border-divider bg-surface px-3 rounded-lg">\n`,
  },

  'ARCH-25': {
    // #cccccc sobre #ffffff da 1.61:1, contra el mínimo AA de 4.5.
    // El tema oscuro tiene que existir aunque no aporte: el parser exige los dos
    // bloques y sin el segundo la regla no corre (fail-open) en vez de fallar.
    ruta: 'src/styles/tokens/_variables.scss',
    contenido: `:root {\n  --bg-base: #ffffff;\n  --text-primary: #cccccc;\n}\n\n[data-mode="dark"] {\n  --bg-base: #111111;\n}\n`,
  },

  'ARCH-26': {
    // --color-base genera `text-base`, que le gana a la utilidad nativa de la
    // escala tipográfica: el texto sale del color del fondo.
    ruta: 'src/tailwind.css',
    contenido: `@theme {\n  --color-brand: #123456;\n  --color-base: #ffffff;\n}\n`,
  },

  // ── Las tres de seguridad ──────────────────────────────────────────────────
  //
  // Se agregaron al linter después de que se generara el baseline, así que
  // entraron por la puerta que el propio provocador vigila: «regla nueva sin
  // fixture». Eso hacía fallar la corrida entera — el chequeo estaba en rojo y
  // lo que reportaba era cierto. Son, además, las tres reglas cuyo silencio
  // cuesta más caro: una tabla sin RLS es lectura pública.

  'SEC-RLS-03': {
    ruta: 'supabase/migrations/001_fixture.sql',
    contenido: `CREATE TABLE public.notas (\n  id uuid PRIMARY KEY\n);\n`,
  },

  'SEC-RLS-01': {
    // RLS activado y ninguna política: la tabla queda inaccesible para todos, que
    // es distinto de insegura — y también es un error.
    ruta: 'supabase/migrations/001_fixture.sql',
    contenido: `CREATE TABLE public.notas (\n  id uuid PRIMARY KEY\n);\n\nALTER TABLE public.notas ENABLE ROW LEVEL SECURITY;\n`,
  },

  'SEC-RLS-02': {
    // `USING (true)` en un FOR UPDATE: cualquiera edita la fila de cualquiera.
    ruta: 'supabase/migrations/001_fixture.sql',
    contenido: `CREATE TABLE public.notas (\n  id uuid PRIMARY KEY,\n  user_id uuid NOT NULL\n);\n\nALTER TABLE public.notas ENABLE ROW LEVEL SECURITY;\n\nCREATE POLICY notas_write ON public.notas\n  FOR UPDATE USING (true);\n`,
  },

  'ARCH-02': {
    // Un componente vista inyectando un *Service directo. `GsapAnimationsService`
    // está en la allowlist y `*FacadeService` queda fuera por sufijo: el fixture
    // usa un nombre que no es ninguno de los dos.
    ruta: 'src/app/features/fixture.component.ts',
    contenido: `import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PedidosService } from '@core/services/pedidos.service';

@Component({
  selector: 'app-fixture',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<p>x</p>',
})
export class FixtureComponent {
  private readonly pedidos = inject(PedidosService);
}
`,
  },

  'ARCH-06': {
    // *ngIf en un template. La sintaxis vieja compila igual: nada la delata.
    ruta: 'src/app/features/fixture.component.html',
    contenido: `<div *ngIf="visible">contenido</div>\n`,
  },

  'ARCH-07': {
    // @keyframes en el .scss de un componente.
    //
    // La ruta importa y no es intercambiable: el linter recorre
    // `src/app/{features,shared,core,layout}`, y `src/styles/` —la capa de
    // motion del design system— queda FUERA a propósito. Ahí viven
    // `_animations.scss`, las view transitions (que no se pueden hacer con
    // GSAP) y los overrides de PrimeNG: siete `@keyframes` curados que esta
    // regla no debe tocar. Lo que prohíbe es la animación ad-hoc en un
    // componente, que es lo que GsapAnimationsService existe para reemplazar.
    //
    // Un fixture en `src/styles/` no dispara. No lo muevas ahí «para que sea
    // más representativo»: estarías provocando un hueco que es una decisión.
    //
    // `stack.gsap` viene en true por defecto; el blueprint.json va igual para
    // que el fixture no dependa de ese default.
    archivos: [
      { ruta: 'blueprint.json', contenido: `{ "stack": { "gsap": true } }\n` },
      {
        ruta: 'src/app/features/fixture.component.scss',
        contenido: `@keyframes aparecer {\n  from { opacity: 0; }\n  to { opacity: 1; }\n}\n`,
      },
    ],
  },

  'ARCH-08': {
    // Color de la paleta cruda de Tailwind en vez de un token semántico.
    ruta: 'src/app/features/fixture.component.html',
    contenido: `<p class="text-red-500">error</p>\n`,
  },

  'ARCH-10': {
    // Seis inject() en una Facade: el límite es cinco.
    ruta: 'src/app/core/facades/fixture.facade.ts',
    contenido: `import { Injectable, inject } from '@angular/core';
import { A } from './a';
import { B } from './b';
import { C } from './c';
import { D } from './d';
import { E } from './e';
import { F } from './f';

@Injectable({ providedIn: 'root' })
export class FixtureFacade {
  private readonly a = inject(A);
  private readonly b = inject(B);
  private readonly c = inject(C);
  private readonly d = inject(D);
  private readonly e = inject(E);
  private readonly f = inject(F);
}
`,
  },

  'A11Y-03': {
    // Botón cuyo único contenido es un icono, sin aria-label: para un lector de
    // pantalla es un botón sin nombre.
    ruta: 'src/app/features/fixture.component.html',
    contenido: `<button (click)="borrar()"><app-icon name="trash" /></button>\n`,
  },

  'ICON-01': {
    // Icono usado en un template y ausente del pick() de app.config: lucide no
    // rompe el build, lanza en runtime cuando alguien abre esa pantalla.
    //
    // El icono NO va dentro de un botón, a propósito: ahí dispararía también
    // A11Y-03 y el fixture dejaría de identificar qué regla habló.
    archivos: [
      {
        ruta: 'src/app/features/fixture.component.html',
        contenido: `<span class="inline-flex"><app-icon name="rocket" /></span>\n`,
      },
      {
        ruta: 'src/app/app.config.ts',
        contenido: `import { ApplicationConfig } from '@angular/core';
import { Home } from 'lucide-angular';

export const appConfig: ApplicationConfig = {
  providers: [LucideAngularModule.pick({ Home })],
};
`,
      },
    ],
  },

  'ARCH-21': {
    // Clase del sistema bento definida en el SCSS y ausente del allowlist: el
    // grid crece por acumulación si nadie la aprueba a mano.
    archivos: [
      {
        ruta: 'src/styles/layout/_bento-grid.scss',
        contenido: `.bento-grid { display: grid; }\n.bento-inventada { grid-column: span 2; }\n`,
      },
      {
        ruta: 'scripts/lib/bento-classes.allowlist.json',
        contenido: `{ "classes": ["bento-grid"] }\n`,
      },
    ],
  },

  'NAV-01': {
    // El menú apunta a una ruta que no existe: el usuario hace clic y cae en el
    // not-found. Ningún build lo delata porque son dos archivos que no se citan.
    archivos: [
      {
        ruta: 'src/app/app.routes.ts',
        contenido: `import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: 'inicio', loadComponent: () => import('./features/inicio') },
];
`,
      },
      {
        ruta: 'src/app/core/services/menu-config.service.ts',
        contenido: `import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class MenuConfigService {
  readonly items = [
    { label: 'Inicio', routerLink: '/inicio' },
    { label: 'Reportes', routerLink: '/reportes' },
  ];
}
`,
      },
    ],
  },

  'ARCH-09': {
    // Un componente de shared/ con 201 miembros triviales: el cuerpo pasa de 200
    // líneas sin que ninguna otra regla tenga nada que decir.
    //
    // El template es de una línea A PROPÓSITO (INC-008). Antes ARCH-09 medía el
    // span del ClassDeclaration, y en el AST de TypeScript los decoradores son
    // parte de ese nodo: con template inline la regla contaba HTML y lo llamaba
    // «clase demasiado grande». Un fixture con template largo habría disparado
    // igual y no habría distinguido una regla arreglada de una rota.
    ruta: 'src/app/shared/components/fixture/fixture.component.ts',
    contenido: `import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-fixture',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<p>x</p>',
})
export class FixtureComponent {
${Array.from({ length: 201 }, (_, i) => `  campo${i} = ${i};`).join('\n')}
}
`,
  },
};

/**
 * Los archivos de un fixture, en su forma larga.
 *
 * Acepta `{ ruta, contenido }` —la forma corta, que es la de la mayoría— y
 * `{ archivos: [{ ruta, contenido }] }` para las reglas que comparan dos
 * archivos entre sí.
 */
export function archivosDe(fixture) {
  if (Array.isArray(fixture?.archivos)) return fixture.archivos;
  if (fixture?.ruta) return [{ ruta: fixture.ruta, contenido: fixture.contenido }];
  return [];
}

/**
 * Qué reglas quedaron sin fixture, y cuáles son nuevas respecto del baseline.
 *
 * Devuelve tres listas porque son tres problemas distintos:
 *
 *   · `sinFixture` — el estado actual. Informativo.
 *   · `nuevasSinFixture` — reglas agregadas después del baseline. **Fallan**: el
 *     momento de escribir el fixture es cuando se escribe la regla, no después.
 *   · `baselineObsoleto` — entradas del baseline que ya tienen fixture o que ya
 *     no existen. Un baseline que no se achica deja de ser un trinquete y pasa a
 *     ser una lista de excusas.
 */
export function auditarProvocacion({ registradas, conFixture, baseline }) {
  const tieneFixture = new Set(conFixture);
  const enBaseline = new Set(baseline);

  const sinFixture = registradas.filter((r) => !tieneFixture.has(r));
  const nuevasSinFixture = sinFixture.filter((r) => !enBaseline.has(r));
  const baselineObsoleto = baseline.filter(
    (r) => tieneFixture.has(r) || !registradas.includes(r),
  );

  return { sinFixture, nuevasSinFixture, baselineObsoleto };
}

/**
 * ¿La salida del linter nombra esta regla?
 *
 * Se busca `[ARCH-04]` con corchetes y no el ID suelto: al final de una corrida
 * fallida el linter imprime la lista de TODAS las reglas validadas, y buscar el
 * ID pelado daría positivo siempre. Es la clase de falso verde que este archivo
 * existe para evitar — y que casi se comete al escribirlo.
 */
export function disparo(salida, ruleId) {
  return salida.includes(`[${ruleId}]`);
}
