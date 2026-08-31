#!/usr/bin/env node
/**
 * contracts.test.js — Contract tests de lib/contracts.js
 *
 * Esta es la pieza que convierte los 12 ACO en algo verificable. Una tabla en un
 * .md no se puede correr; este registro si.
 *
 * Las rutas del registro son relativas al PROYECTO GENERADO. Acá viven bajo
 * templates/, así que hay que mapearlas — y ese mapeo es en sí mismo el contrato
 * entre el payload y lo que recibe el usuario.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const C = require(path.resolve(__dirname, '..', 'hooks', 'lib', 'contracts.js'));

const TEMPLATES = path.resolve(__dirname, '..', '..');

/**
 * Resuelve una ruta del registro contra el arbol real.
 *
 * El registro declara rutas del PROYECTO GENERADO. Este archivo corre en dos
 * contextos: en el repo del CLI —donde scripts/ vive bajo boilerplate/— y
 * dentro de un proyecto ya generado, donde vive en la raiz. Se prueban las dos
 * y gana la que exista; si no existe ninguna, se devuelve la directa para que
 * el mensaje de error nombre la ruta esperada.
 */
function enRepo(rel) {
  const directa = path.join(TEMPLATES, rel);
  if (fs.existsSync(directa)) return directa;
  const enBoilerplate = path.join(TEMPLATES, 'boilerplate', rel);
  if (fs.existsSync(enBoilerplate)) return enBoilerplate;
  return directa;
}

describe('EL REGISTRO EXISTE DE VERDAD — cada pieza declarada es un archivo', () => {
  for (const entry of C.all()) {
    for (const pieza of C.piezasDe(entry)) {
      test(`${entry.id} → ${pieza}`, () => {
        assert.ok(fs.existsSync(enRepo(pieza)), `declarado y no existe: ${pieza}`);
      });
    }
  }
});

describe('CADA PIEZA NOMBRA EL ARTEFACTO QUE DICE USAR', () => {
  // Si un hook deja de leer un contrato, esta prueba lo delata: el registro
  // quedaria declarando un consumidor que ya no consume.
  // Los ids con <> nombran una FAMILIA de archivos (uno por categoria, uno por
  // clave). La aguja es el prefijo comun, que es lo que el codigo escribe.
  const marca = {
    'discovery-flag': 'discovery',
    'task-spec': 'task-spec-',
    'specs/.active': '.active',
    'ctx-<categoria>.json': 'ctx-',
    'budget-<clave>.json': 'budget-',
  };

  for (const entry of C.all()) {
    const aguja = marca[entry.id] || entry.id;
    for (const pieza of C.piezasDe(entry)) {
      test(`${pieza} menciona "${aguja}"`, () => {
        const full = enRepo(pieza);
        if (!fs.existsSync(full)) return; // lo cubre el describe anterior
        assert.ok(
          fs.readFileSync(full, 'utf-8').includes(aguja),
          `${pieza} está declarado para ${entry.id} y no lo nombra`,
        );
      });
    }
  }
});

describe('LIFETIME Y SCOPE — los dos campos que los ADR agregaron', () => {
  const LIFETIMES = ['turno', 'sesion', 'permanente'];
  const SCOPES = ['sesion', 'hilo', 'proyecto'];

  for (const entry of C.all()) {
    test(`${entry.id} declara lifetime y scope válidos`, () => {
      assert.ok(LIFETIMES.includes(entry.lifetime), `lifetime inválido: ${entry.lifetime}`);
      assert.ok(SCOPES.includes(entry.scope), `scope inválido: ${entry.scope}`);
    });
  }

  test('ningún artefacto de ciclo "sesion" lo borra un hook de Stop (ADR-002 §1)', () => {
    const deSesion = C.all().filter((e) => e.lifetime === 'sesion').map((e) => e.id);
    assert.ok(deSesion.includes('session-writes.json'));
    assert.ok(deSesion.includes('discovery-flag'));
  });

  test('todo artefacto declara un formato legible por su consumidor', () => {
    for (const e of C.all()) {
      assert.ok(e.format && e.format.length > 10, `${e.id} sin formato declarado`);
    }
  });
});

describe('NINGÚN ESTADO SIN DECLARAR (ACO-006, ACO-007)', () => {
  // Los 12 ACO salieron de artefactos que una pieza escribía y otra leía sin que
  // figuraran en ningún lado. Declararlos a mano no impide que aparezca el 13º;
  // esto sí: se leen las claves que los hooks escriben de verdad y se exige que
  // cada una tenga una fila. Una clave nueva sin declarar rompe este test.

  const HOOKS = path.join(TEMPLATES, '.claude', 'hooks');

  function archivosJs(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) return e.name === 'lib' ? [] : archivosJs(full);
      return e.name.endsWith('.js') ? [full] : [];
    });
  }

  /**
   * `writeState(x, 'breaker.json'` y `appendState(x, 'discovery.flag'` → la clave.
   *
   * Resuelve UN nivel de indirección: `pre-write-guard` arma la clave en una
   * variable (`const clave = \`ctx-${cat}.json\``) y pasa la variable. Sin esto,
   * el único hook con estado por categoría se escapaba del chequeo y el test
   * pasaba en verde sin mirarlo — que es exactamente el tipo de decoración que
   * esta auditoría cataloga como `DEC`.
   */
  function clavesEscritas(src) {
    const out = [];
    const re = /(?:writeState|appendState)\s*\(\s*[A-Za-z_$][\w$]*\s*,\s*(?:(['"`])([^'"`]+)\1|([A-Za-z_$][\w$]*))/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      if (m[2]) { out.push(m[2]); continue; }
      const asign = new RegExp(
        `(?:const|let|var)\\s+${m[3]}\\s*=\\s*(['"\`])([^'"\`]+)\\1`).exec(src);
      if (asign) out.push(asign[2]);
      else throw new Error(
        `no se pudo resolver la clave "${m[3]}": declarala como literal o extendé el detector`);
    }
    return out;
  }

  /** La familia a la que pertenece una clave: `ctx-features.json` → `ctx-`. */
  const familias = C.all()
    .map((e) => e.id)
    .filter((id) => id.includes('<'))
    .map((id) => id.slice(0, id.indexOf('<')));

  const declarado = new Set(C.all().map((e) => e.id));
  declarado.add('discovery.flag'); // se declara como `discovery-flag`

  for (const archivo of archivosJs(HOOKS)) {
    const claves = clavesEscritas(fs.readFileSync(archivo, 'utf-8'));
    if (claves.length === 0) continue;
    const rel = path.relative(TEMPLATES, archivo);

    test(`${rel} solo escribe estado declarado`, () => {
      for (const k of claves) {
        const cubierta = declarado.has(k) || familias.some((f) => k.startsWith(f));
        assert.ok(cubierta,
          `${rel} escribe "${k}" y no hay fila en contracts.js — ese es el 13º ACO`);
      }
    });
  }

  test('el detector encuentra las claves que ya conocemos', () => {
    // Si el regex dejara de matchear, el describe entero pasaría por vacío.
    const claves = clavesEscritas(fs.readFileSync(path.join(HOOKS, 'pre-write-guard.js'), 'utf-8'));
    assert.ok(claves.includes('breaker.json'), 'sin esto, un test verde no probaría nada');
    assert.ok(claves.some((k) => k.startsWith('ctx-')),
      'la clave por categoría va en una variable: si no se resuelve, no se está mirando');
  });

  test('y una clave nueva sin declarar lo rompe', () => {
    // Provocación: el mecanismo tiene que fallar ante su propia violación.
    const inventadas = clavesEscritas("session.writeState(input, 'inventada.json', {})");
    assert.deepEqual(inventadas, ['inventada.json']);
    const cubierta = declarado.has('inventada.json')
      || familias.some((f) => 'inventada.json'.startsWith(f));
    assert.equal(cubierta, false, 'si esto pasara, el describe entero sería decorativo');
  });
});

describe('LOS 15 ÍNDICES — la lista canónica contra el filesystem (HUE-030)', () => {
  const enDisco = fs.readdirSync(path.join(TEMPLATES, 'indices'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''))
    .sort();

  test('INDICES coincide exactamente con templates/indices/', () => {
    assert.deepEqual([...C.INDICES].sort(), enDisco);
  });

  test('son 15', () => assert.equal(C.INDICES.length, 15));
});

describe('HUE-003 — el hueco conocido, fijado tal como está hoy', () => {
  // Test de caracterización: describe el comportamiento ACTUAL, bug incluido.
  // Cuando la tanda 3 migre compact-recovery, este test falla y hay que
  // actualizarlo a propósito. Es la diferencia entre un hueco documentado y uno
  // olvidado.
  const AUSENTES_HOY = ['GUARDS', 'LAYOUTS', 'ROUTES', 'USAGE-MAP', 'UTILS'];

  for (const pieza of C.CONSUMIDORES_DE_INDICES) {
    test(`${pieza} conoce 10 de los 15 índices`, () => {
      const src = fs.readFileSync(enRepo(pieza), 'utf-8');
      const conocidos = C.INDICES.filter((n) => src.includes(n));
      const faltan = C.INDICES.filter((n) => !src.includes(n));
      assert.deepEqual(faltan.sort(), [...AUSENTES_HOY].sort(),
        'cambió qué índices ignora compact-recovery: actualizá este test a propósito');
      assert.equal(conocidos.length, 10);
    });
  }
});

describe('API', () => {
  test('consumersOf y producersOf devuelven [] para un id desconocido', () => {
    assert.deepEqual(C.consumersOf('no-existe'), []);
    assert.deepEqual(C.producersOf('no-existe'), []);
  });

  test('piezasDe saltea los actores entre <>', () => {
    const piezas = C.piezasDe(C.CONTRACTS['blueprint.json']);
    assert.ok(!piezas.some((p) => p.startsWith('<')));
    assert.ok(piezas.includes('scripts/architect.js'));
  });

  test('all() devuelve cada fila con su id', () => {
    const ids = C.all().map((e) => e.id);
    assert.equal(ids.length, Object.keys(C.CONTRACTS).length);
    assert.ok(ids.includes('session-writes.json'));
  });
});
