#!/usr/bin/env node
/**
 * paths.test.js — Contract tests de lib/paths.js
 *
 * El primer describe es el que importa: fija que las tres preguntas son
 * DISTINTAS. Si alguien las colapsa en una, falla acá y no en producción.
 *
 * El segundo fija las divergencias que existían entre las tres copias, y que
 * se midieron antes de escribir el módulo.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const P = require(path.resolve(__dirname, '..', 'hooks', 'lib', 'paths.js'));

const CWD = '/proyecto';
const c = (p) => P.classify(path.posix.join(CWD, p), CWD);

describe('SON TRES PREGUNTAS DISTINTAS — no colapsar', () => {
  test('un .spec.ts es producto (necesita spec) pero NO va a ningún índice', () => {
    const r = c('src/app/features/x/x.component.spec.ts');
    assert.equal(r.isProductCode, true, 'un test es código de producto');
    assert.equal(r.belongsToIndex, false, 'pero no se registra en COMPONENTS.md');
    assert.equal(r.needsDiscovery, false, 'ni obliga a descubrir antes');
  });

  test('una migración responde que sí a las tres — DATABASE.md es un índice (HUE-015)', () => {
    // Estuvo en `false` con un motivo escrito: «las cubre DATABASE.md por otra
    // vía». El motivo confundía QUIÉN genera DATABASE.md con si la escritura
    // OBLIGA a actualizarlo, que es lo único que esta función pregunta.
    const r = c('supabase/migrations/001_init.sql');
    assert.equal(r.isProductCode, true);
    assert.equal(r.needsDiscovery, true);
    assert.equal(r.belongsToIndex, true);
  });

  test('pero solo el .sql: lo demás bajo supabase/ no obliga a nada (HUE-015)', () => {
    // Un guardrail que se dispara de más se termina ignorando, así que el borde
    // va fijado: config, prosa y edge functions quedan afuera.
    for (const f of ['supabase/config.toml', 'supabase/migrations/README.md',
      'supabase/functions/enviar-mail/index.ts']) {
      assert.equal(c(f).belongsToIndex, false, f);
    }
  });

  test('y una migración anidada en docs/ tampoco — se compara por prefijo', () => {
    assert.equal(c('docs/ejemplos/supabase/migrations/y.sql').belongsToIndex, false);
  });

  test('un componente responde que sí a las tres', () => {
    const r = c('src/app/features/reportes/reportes.component.ts');
    assert.deepEqual(
      [r.isProductCode, r.needsDiscovery, r.belongsToIndex],
      [true, true, true],
    );
  });

  test('un archivo suelto en src/ es producto, pero no obliga a descubrir', () => {
    const r = c('src/main.ts');
    assert.equal(r.isProductCode, true);
    assert.equal(r.needsDiscovery, false, 'no toca la app Angular ni el esquema');
    assert.equal(r.belongsToIndex, false);
  });

  test('las tres respuestas no son nunca la misma columna', () => {
    const casos = [
      'src/app/x.component.ts', 'src/app/x.component.spec.ts',
      'supabase/migrations/1.sql', 'src/main.ts', 'docs/guia.md',
      'supabase/config.toml',
      // El caso que separa `needsDiscovery` de `belongsToIndex` desde HUE-015:
      // un .json bajo src/app/ obliga a haber leído los índices —es la app— y
      // no va a ninguno, porque ningún índice describe datos sueltos. Sin él,
      // las dos columnas coinciden y este test dejaría de probar nada.
      'src/app/features/datos.json',
    ].map(c);
    const cols = ['isProductCode', 'needsDiscovery', 'belongsToIndex']
      .map((k) => casos.map((r) => r[k]).join(''));
    assert.equal(new Set(cols).size, 3, `las tres columnas deben diferir: ${cols}`);
  });
});

describe('LAS DIVERGENCIAS QUE HABÍA — ahora hay una sola respuesta', () => {
  // Medido antes de escribir el módulo: spec-gate salía en 0 ("no es producto")
  // y plan-injector inyectaba 1.570 chars ("sí es producto") para los mismos
  // dos archivos, porque cada uno llevaba su propia lista de exentos.
  for (const archivo of ['src/guia.mdx', 'src/.npmrc']) {
    test(`${archivo} — una sola respuesta, y es "no es producto"`, () => {
      assert.equal(c(archivo).isProductCode, false);
    });
  }

  test('las extensiones exentas son la unión de las dos listas que existían', () => {
    for (const ext of ['.md', '.mdx', '.json', '.yaml', '.yml', '.toml', '.lock',
      '.gitignore', '.npmrc', '.env', '.editorconfig']) {
      assert.equal(c(`src/archivo${ext}`).isProductCode, false, `${ext} debe estar exenta`);
    }
  });

  test('los basenames sin extensión también', () => {
    for (const base of ['Dockerfile', 'Makefile', 'LICENSE', 'README']) {
      assert.equal(c(`src/${base}`).isProductCode, false);
    }
  });
});

describe('PREFIJO, NO SUBSTRING — el bug de .includes()', () => {
  test('docs/ejemplos/src/app/x.ts NO es código de la app', () => {
    const r = c('docs/ejemplos/src/app/x.component.ts');
    assert.equal(r.needsDiscovery, false, 'con .includes("src/app/") daba true');
    assert.equal(r.belongsToIndex, false);
    assert.equal(r.isProductCode, false, 'docs/ está exento por prefijo');
  });

  test('node_modules/paquete/src/app/x.ts tampoco', () => {
    const r = c('node_modules/algo/src/app/x.component.ts');
    assert.equal(r.needsDiscovery, false);
    assert.equal(r.isProductCode, false);
  });

  test('un archivo fuera del proyecto no es de nadie', () => {
    const r = P.classify('/otro/lado/src/app/x.ts', CWD);
    assert.equal(r.rel, '');
    assert.equal(r.isProductCode, false);
    assert.equal(r.needsDiscovery, false);
    assert.equal(r.belongsToIndex, false);
  });
});

describe('EXENTOS POR PREFIJO — el harness no es producto', () => {
  for (const pre of ['specs/', '.claude/', 'docs/', 'indices/', 'scripts/',
    'context/', 'node_modules/', '.git/', 'dist/', 'build/', 'coverage/']) {
    test(`${pre} no es código de producto`, () => {
      assert.equal(c(`${pre}algo/archivo.ts`).isProductCode, false);
    });
  }
});

describe('RAÍCES DE PRODUCTO', () => {
  const si = ['src/x.ts', 'app/x.ts', 'lib/x.ts', 'supabase/migrations/1.sql',
    'packages/ui/src/boton.ts'];
  const no = ['otro/x.ts', 'packages/ui/dist/boton.ts', 'test/x.ts'];

  for (const p of si) test(`${p} es producto`, () => assert.equal(c(p).isProductCode, true));
  for (const p of no) test(`${p} no lo es`, () => assert.equal(c(p).isProductCode, false));
});

describe('BELONGS TO INDEX — solo la superficie que los índices describen', () => {
  test('acepta .ts, .html y .scss bajo src/app/', () => {
    for (const ext of ['.ts', '.html', '.scss']) {
      assert.equal(c(`src/app/shared/kpi/kpi.component${ext}`).belongsToIndex, true);
    }
  });

  test('rechaza otras extensiones bajo src/app/', () => {
    for (const ext of ['.css', '.svg', '.png', '.txt']) {
      assert.equal(c(`src/app/shared/kpi/kpi${ext}`).belongsToIndex, false);
    }
  });

  test('rechaza .spec.ts', () => {
    assert.equal(c('src/app/shared/kpi/kpi.component.spec.ts').belongsToIndex, false);
  });
});

describe('ENTRADAS DEGENERADAS — fail-safe', () => {
  for (const [nombre, valor] of [['vacía', ''], ['null', null], ['undefined', undefined]]) {
    test(`ruta ${nombre} → todo false, sin lanzar`, () => {
      const r = P.classify(valor, CWD);
      assert.deepEqual(
        [r.isProductCode, r.needsDiscovery, r.belongsToIndex],
        [false, false, false],
      );
    });
  }

  test('acepta separadores de Windows', () => {
    const r = P.classify('src\\app\\x.component.ts', CWD);
    assert.equal(r.belongsToIndex, true);
  });

  test('acepta rutas relativas además de absolutas', () => {
    assert.equal(P.classify('src/app/x.component.ts', CWD).belongsToIndex, true);
  });
});
