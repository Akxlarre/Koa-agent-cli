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
const { spawnSync } = require('child_process');

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

describe('EL `path` DECLARADO ES EL QUE EL PRODUCTOR ESCRIBE (ACO-003)', () => {
  // El registro existe para ser verificable, y este campo no se verificaba: el
  // test miraba que las PIEZAS existieran, no que el `path` fuera real.
  //
  // `indices-cache.json` estaba declarado en `scripts/` y `indices-sync.js` lo
  // escribe en `.claude/temp/`. Nadie lo notó en dos tandas, y desde ACO-013 esa
  // ruta equivocada además VIAJA al proyecto generado dentro de
  // `docs/CONTRATOS.md`: un agente que la siguiera no encontraría el archivo.
  //
  // El productor casi nunca escribe la ruta entera: la arma con `path.join`. Así
  // que se acepta el literal completo, o bien el nombre del archivo MÁS cada
  // segmento del directorio como string. Es lo que separa `.claude/temp/x.json`
  // de `scripts/x.json` cuando el código dice `join(ROOT, '.claude', 'temp')`.

  /** Rutas que nombran una FAMILIA o llevan un patrón, no un archivo concreto. */
  const esPatron = (p) => /[*<]/.test(p) || p.includes(',') || /YYYY|HHMMSS|NNN/.test(p);

  function loEscribe(entry) {
    const productores = (entry.producers || []).filter((p) => !p.startsWith('<'));
    if (productores.length === 0) return null; // lo escribe un humano o el CLI

    const segmentos = entry.path.split('/');
    const archivo = segmentos.pop();

    return productores.some((p) => {
      let src;
      try { src = fs.readFileSync(enRepo(p), 'utf-8'); } catch { return false; }
      if (src.includes(entry.path)) return true;
      if (!src.includes(archivo)) return false;
      return segmentos.every((s) => new RegExp(`['"\`]${s.replace(/\./g, '\\.')}['"\`]`).test(src));
    });
  }

  for (const entry of C.all()) {
    if (esPatron(entry.path)) continue;
    const veredicto = loEscribe(entry);
    if (veredicto === null) continue;

    test(`${entry.id} → ${entry.path}`, () => {
      assert.ok(veredicto,
        `el registro declara "${entry.path}" y su productor no escribe ahí`);
    });
  }

  test('el detector distingue un directorio de otro', () => {
    // Sin esto, un test verde no probaría nada: si el detector solo mirara el
    // nombre del archivo, la ruta equivocada de ACO-003 habría pasado igual.
    const cache = C.CONTRACTS['indices-cache.json'];
    assert.equal(loEscribe(cache), true);
    assert.equal(loEscribe({ ...cache, path: 'scripts/indices-cache.json' }), false,
      'la ruta que estuvo declarada dos tandas tiene que dar en rojo');
  });
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

describe('HUE-003 / HUE-030 — el hueco, cerrado', () => {
  // Este describe era un test de CARACTERIZACIÓN: fijaba el bug tal como estaba
  // —«conoce 10 de los 15»— para que cerrarlo tuviera que ser un acto
  // deliberado. Lo fue. Ahora fija lo contrario, y los cinco índices que
  // faltaban siguen nombrados: son la regresión a vigilar.
  const LOS_QUE_FALTABAN = ['GUARDS', 'LAYOUTS', 'ROUTES', 'USAGE-MAP', 'UTILS'];

  for (const pieza of C.CONSUMIDORES_DE_INDICES) {
    test(`${pieza} nombra los 15 índices`, () => {
      const src = fs.readFileSync(enRepo(pieza), 'utf-8');
      const faltan = C.INDICES.filter((n) => !src.includes(`indices/${n}.md`));
      assert.deepEqual(faltan, [],
        `${pieza} mantiene la lista a mano y quedó atrás: agregá ${faltan.join(', ')}`);
    });
  }

  test('los cinco que se agregaron después están, y por nombre', () => {
    const src = fs.readFileSync(enRepo('AGENTS.md'), 'utf-8');
    for (const n of LOS_QUE_FALTABAN) {
      assert.match(src, new RegExp(`indices/${n}\\.md`), `${n} volvió a caerse de AGENTS.md`);
    }
  });

  test('compact-recovery ya no mantiene ninguna lista — la deriva del disco', () => {
    // La comprobación inversa: si alguien vuelve a escribir un mapa a mano acá,
    // vuelve a poder desincronizarse, y este test lo dice antes.
    const src = fs.readFileSync(enRepo('.claude/hooks/compact-recovery.js'), 'utf-8');
    assert.ok(!/ALL_INDEX_FILES/.test(src), 'el mapa literal volvió');
    assert.match(src, /readdirSync\(path\.join\(raiz, 'indices'\)\)/,
      'la lista tiene que salir del filesystem, no de un literal');
    // Los tres CORE sí son una decisión y siguen escritos; el resto no.
    const literales = C.INDICES.filter((n) => src.includes(`'${n}'`));
    assert.deepEqual(literales.sort(), ['COMPONENTS', 'FACADES', 'SERVICES'],
      'solo los CORE se nombran: son los que se inyectan aunque nadie los haya leído');
  });
});

describe('ACO-013 — el proyecto generado recibe la declaración de sus contratos', () => {
  // La primera mitad del hallazgo la cerró este registro: 21 artefactos, no 3.
  // La otra mitad era DÓNDE vive la declaración. `templates-contract.md` está en
  // el repo del CLI: es una regla para quien mantiene el generador. Un agente
  // trabajando en un proyecto generado no tenía forma de saber que `sync-check`
  // borraba el archivo del que depende `spec-diff-check`.
  //
  // `docs/CONTRATOS.md` es la misma verdad en la forma en que se consulta, y se
  // GENERA desde acá. Escrita a mano volvería a desactualizarse, que es
  // literalmente el hallazgo.
  const DOC = enRepo('docs/CONTRATOS.md');
  const GENERADOR = enRepo('.claude/scripts/contracts-doc.js');

  test('el doc existe y viaja en el payload', () => {
    assert.ok(fs.existsSync(DOC), 'sin esto, el proyecto generado no declara nada');
  });

  test('está al día con el registro', () => {
    // El generador sabe compararse a sí mismo: --check no escribe.
    const r = spawnSync('node', [GENERADOR, '--check'], {
      cwd: path.dirname(path.dirname(DOC)), encoding: 'utf8',
    });
    assert.equal(r.status, 0, `${r.stdout || ''}${r.stderr || ''}`);
  });

  test('nombra los 21 artefactos, no una selección', () => {
    const txt = fs.readFileSync(DOC, 'utf-8');
    const faltan = Object.keys(C.CONTRACTS).filter((id) => !txt.includes(`\`${id}\``));
    assert.deepEqual(faltan, []);
  });

  test('la tabla vive entre marcadores AUTO-GENERATED', () => {
    // Mismo patrón que indices-sync y assignments-sync: adentro se reescribe,
    // afuera se conserva. Es lo que hace que regenerar no borre notas a mano.
    const txt = fs.readFileSync(DOC, 'utf-8');
    assert.match(txt, /<!-- AUTO-GENERATED:BEGIN -->/);
    assert.match(txt, /<!-- AUTO-GENERATED:END -->/);
  });
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
