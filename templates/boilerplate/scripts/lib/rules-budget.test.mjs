import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  costoDe, globARegex, leerReglas, medirTodo, pathsDe, RUTAS_REPRESENTATIVAS, TOPES,
} from './rules-budget.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

/**
 * `.claude/rules/` visto desde acá. Este archivo corre en dos contextos: en el
 * repo del CLI, donde `scripts/` vive bajo `templates/boilerplate/`, y dentro de
 * un proyecto generado, donde vive en la raíz.
 */
function dirReglas() {
  for (const p of [
    path.resolve(AQUI, '..', '..', '..', '.claude', 'rules'), // repo del CLI
    path.resolve(AQUI, '..', '..', '.claude', 'rules'),       // proyecto generado
  ]) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

describe('globARegex', () => {
  const casos = [
    ['src/app/**/*.ts', 'src/app/features/x/y.ts', true],
    ['src/app/**/*.ts', 'src/app/main.ts', true, '**/ puede colapsar a nada'],
    ['src/app/**/*.ts', 'src/app/x.html', false],
    ['src/app/**/*.ts', 'otro/app/x.ts', false],
    ['src/app/features/**', 'src/app/features/a/b/c.html', true],
    ['src/app/features/**', 'src/app/shared/a.ts', false],
    ['src/app/core/services/supabase*', 'src/app/core/services/supabase.service.ts', true],
    ['src/app/core/services/supabase*', 'src/app/core/services/otro/supabase.ts', false,
      '* no cruza barras'],
    ['supabase/**', 'supabase/migrations/001.sql', true],
  ];

  for (const [glob, ruta, esperado, nota] of casos) {
    test(`${glob} ${esperado ? '→' : '↛'} ${ruta}${nota ? ` (${nota})` : ''}`, () => {
      assert.equal(globARegex(glob).test(ruta), esperado);
    });
  }

  test('el punto es literal, no comodín', () => {
    assert.equal(globARegex('src/a.ts').test('src/axts'), false);
  });
});

describe('pathsDe', () => {
  test('lee los globs del frontmatter', () => {
    const md = '---\npaths:\n  - "src/app/**/*.ts"\n  - "supabase/**"\n---\n\n# Regla\n';
    assert.deepEqual(pathsDe(md), ['src/app/**/*.ts', 'supabase/**']);
  });

  test('una regla sin frontmatter no matchea nada', () => {
    assert.deepEqual(pathsDe('# Regla suelta\n'), []);
    assert.deepEqual(costoDe('src/app/x.ts', [{ nombre: 'x.md', globs: [], chars: 999 }]).chars, 0);
  });
});

describe('EL TOPE POR RUTA — que ninguna regla nueva lo suba sin que se note', () => {
  // Sin esto, la siguiente regla que alguien agregue con `src/app/**/*.ts` vuelve
  // a subir el peor caso en silencio: así se llegó a 76.391 chars por editar un
  // componente de feature. Las reglas las inyecta el runtime al matchear `paths:`
  // y ningún hook puede interceptarlas — el único lugar donde poner un tope es acá.
  const dir = dirReglas();

  test('se encontró .claude/rules/', () => {
    assert.ok(dir, 'sin el directorio, todo este describe pasaría por vacío');
    assert.ok(leerReglas(dir).length >= 10);
  });

  if (!dir) return;

  const medidas = new Map(medirTodo(dir).map((m) => [m.ruta, m]));

  for (const [ruta, tope] of Object.entries(TOPES)) {
    test(`${ruta} ≤ ${tope.toLocaleString('es')} chars`, () => {
      const m = medidas.get(ruta);
      assert.ok(m, `${ruta} sin medir`);
      assert.ok(m.chars <= tope,
        `${ruta} paga ${m.chars} chars (tope ${tope}) en ${m.reglas.length} reglas:\n` +
        `  ${m.reglas.join(', ')}\n` +
        '  Si la regla nueva vale lo que cuesta, subí el tope a propósito y decí por qué.');
    });
  }

  test('cada ruta representativa tiene tope, y al revés', () => {
    assert.deepEqual(Object.keys(TOPES).sort(), [...RUTAS_REPRESENTATIVAS].sort());
  });

  test('el detector mide de verdad: el peor caso trae más de diez reglas', () => {
    // Una medición que devolviera 0 reglas haría pasar todos los topes.
    const peor = medidas.get('src/app/features/reportes/reportes.ts');
    assert.ok(peor.reglas.length >= 10, `solo ${peor.reglas.length} reglas`);
    assert.ok(peor.chars > 40_000, `solo ${peor.chars} chars`);
  });

  test('y una regla gigante nueva rompería el tope', () => {
    // Provocación: el mecanismo tiene que fallar ante su propia violación.
    const reglas = [...leerReglas(dir), {
      nombre: 'inventada.md', globs: ['src/app/**/*.ts'], chars: 50_000,
    }];
    const conLaNueva = costoDe('src/app/features/reportes/reportes.ts', reglas);
    assert.ok(conLaNueva.chars > TOPES['src/app/features/reportes/reportes.ts'],
      'si esto no rompiera el tope, el tope sería decorativo');
  });
});

describe('LA PARTICIÓN POR GLOB — que cada ruta pague por lo que puede usar', () => {
  const dir = dirReglas();
  if (!dir) return;

  const de = (ruta) => costoDe(ruta, leerReglas(dir)).reglas;

  test('editar un .scss no trae los patrones de pantalla', () => {
    const reglas = de('src/styles/tokens/_variables.scss');
    assert.ok(reglas.includes('visual-tokens.md'), 'el vocabulario sí lo necesita');
    assert.ok(!reglas.includes('visual-patterns.md'),
      'el patrón App-like no aplica a una hoja de tokens');
  });

  test('un componente de shared/ tampoco', () => {
    const reglas = de('src/app/shared/ui/kpi-card/kpi-card.ts');
    assert.ok(reglas.includes('visual-tokens.md'));
    assert.ok(!reglas.includes('visual-patterns.md'),
      'shared/ compone piezas, no pantallas');
  });

  test('una pantalla de features/ sí los trae', () => {
    assert.ok(de('src/app/features/reportes/reportes.ts').includes('visual-patterns.md'));
  });

  test('una migración SQL no trae reglas de UI', () => {
    const reglas = de('supabase/migrations/001_init.sql');
    assert.deepEqual(reglas, ['database.md'],
      'delegation.md matcheaba hasta acá: 2.992 chars por editar SQL');
  });
});
