/**
 * ARCH-09 mide el CUERPO de la clase, no el archivo (INC-008).
 *
 * `provocar-reglas.mjs` comprueba que la regla pueda disparar. Esto comprueba lo
 * inverso, que es donde estaba el bug: que NO dispare por el tamaño del template.
 *
 * La regla usaba el span del `ClassDeclaration`, y en el AST de TypeScript los
 * decoradores son parte de ese nodo. Con template inline —que es como escribe
 * todo este boilerplate— ARCH-09 contaba HTML y lo reportaba como «clase
 * demasiado grande». Medido sobre el propio payload que reparte el CLI:
 *
 *   section-hero   1.170 «líneas de clase» → 910 el @Component, 258 la clase
 *   tabs             298 «líneas de clase» → 248 el @Component,  48 la clase
 *
 * Una clase de 48 líneas denunciada por tener 298. El usuario veía dos
 * advertencias el primer día, en código que no escribió, con un fix («divide el
 * componente») que no arreglaba nada de lo que la regla realmente medía.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ARCHITECT = path.resolve(AQUI, '..', 'architect.js');

/**
 * El `node_modules` desde donde el sandbox puede resolver `typescript`.
 *
 * `architect.js` parsea con el compilador de TypeScript, y el sandbox vive en
 * `os.tmpdir()`: la resolución de módulos de Node no llega desde ahí a las
 * dependencias del proyecto. En un proyecto generado siempre hay uno (Angular
 * trae TypeScript); se busca subiendo desde este archivo y se le pasa al hijo
 * por `NODE_PATH`.
 *
 * Si no aparece ninguno —correr esto desde el repo del CLI, que no instala
 * TypeScript— los tests se saltean con el motivo escrito. `node --test` cuenta
 * los skipped en su resumen: es visible, no silencioso. Lo mismo le pasa a
 * `provocar-reglas.mjs`, que también necesita al compilador para correr.
 */
function nodeModulesConTypescript() {
  let dir = AQUI;
  for (let i = 0; i < 8; i += 1) {
    const candidato = path.join(dir, 'node_modules');
    if (fs.existsSync(path.join(candidato, 'typescript', 'package.json'))) return candidato;
    const padre = path.dirname(dir);
    if (padre === dir) break;
    dir = padre;
  }
  return null;
}

const NODE_MODULES = nodeModulesConTypescript();

/** Corre el linter contra un sandbox con un solo componente en shared/. */
function lintear(contenido) {
  const caja = fs.mkdtempSync(path.join(os.tmpdir(), 'arch09-'));
  try {
    const destino = path.join(caja, 'src/app/shared/components/fixture/fixture.component.ts');
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, contenido);
    const env = { ...process.env };
    if (NODE_MODULES) {
      env.NODE_PATH = env.NODE_PATH ? `${NODE_MODULES}${path.delimiter}${env.NODE_PATH}` : NODE_MODULES;
    }
    const r = spawnSync(process.execPath, [ARCHITECT], { cwd: caja, encoding: 'utf8', env });
    return `${r.stdout ?? ''}${r.stderr ?? ''}`;
  } finally {
    fs.rmSync(caja, { recursive: true, force: true });
  }
}

const CABECERA = `import { ChangeDetectionStrategy, Component } from '@angular/core';\n\n`;

/** Un componente con `miembros` campos triviales y un template de `filas` líneas. */
function componente({ miembros, filas }) {
  const template = Array.from({ length: filas }, (_, i) => `      <p>fila ${i}</p>`).join('\n');
  const cuerpo = Array.from({ length: miembros }, (_, i) => `  campo${i} = ${i};`).join('\n');
  return `${CABECERA}@Component({
  selector: 'app-fixture',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`
${template}
  \`,
})
export class FixtureComponent {
${cuerpo}
}
`;
}

const SIN_TS = NODE_MODULES
  ? false
  : 'no hay un node_modules con typescript: architect.js no puede parsear (correr en un proyecto generado)';

describe('ARCH-09 — INC-008', { skip: SIN_TS }, () => {
  test('dispara con un cuerpo de clase de más de 200 líneas', () => {
    assert.match(lintear(componente({ miembros: 201, filas: 3 })), /\[ARCH-09\]/);
  });

  test('NO dispara por un template inline enorme con una clase chica', () => {
    // 600 líneas de markup, 5 miembros. Antes: «Clase demasiado grande (612
    // líneas)». La clase tiene cinco.
    const salida = lintear(componente({ miembros: 5, filas: 600 }));
    assert.ok(!salida.includes('[ARCH-09]'),
      `ARCH-09 volvió a contar el template:\n${salida}`);
  });

  test('el mensaje dice cuánto es cuerpo y cuánto es @Component', () => {
    // Sin esa aclaración, el número del aviso no coincide con nada que el
    // usuario pueda ver en su editor, y el fix parece no tener efecto.
    const salida = lintear(componente({ miembros: 201, filas: 400 }));
    assert.match(salida, /líneas de cuerpo/);
    assert.match(salida, /son el @Component/);
  });

  test('un cuerpo justo en el límite no dispara', () => {
    assert.ok(!lintear(componente({ miembros: 200, filas: 3 })).includes('[ARCH-09]'));
  });
});
