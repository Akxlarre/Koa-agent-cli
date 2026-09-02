#!/usr/bin/env node
/**
 * Smoke de los scripts de package.json.
 *
 *   node scripts/smoke-scripts.mjs
 *   node scripts/smoke-scripts.mjs --solo typecheck,test:ci
 *
 * No pregunta si los scripts pasan. Pregunta si **pueden fallar**, que es la
 * pregunta que ningún CI hace y la única que encuentra un comando decorativo.
 *
 * Para los que comprueban código, introduce un defecto a propósito y exige que
 * el script se dé cuenta. El archivo tocado se restaura siempre, incluso si el
 * proceso muere: se escribe una copia antes y se repone en el `finally`.
 *
 * Tarda. Está pensado para correrse al cerrar una sesión o antes de publicar,
 * no en cada guardado.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';
import {
  clasificar, veredicto, resumir, comprobacionesHuerfanas, COMPROBACIONES,
} from './lib/smoke-scripts.js';
import { extraerReglasRegistradas } from './lib/rule-wiring.js';

const raiz = process.cwd();
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const soloArg = process.argv.indexOf('--solo');
const solo = soloArg !== -1 ? (process.argv[soloArg + 1] ?? '').split(',').filter(Boolean) : null;

const c = {
  gris: '\x1b[90m', rojo: '\x1b[31m', verde: '\x1b[32m',
  amarillo: '\x1b[33m', cyan: '\x1b[36m', reset: '\x1b[0m',
};

// ─── Los defectos que se introducen ─────────────────────────────────────────
//
// Cada uno tiene que ser algo que la herramienta correspondiente NO pueda
// ignorar. Un defecto sutil produciría un falso "decorativo" y haría que este
// smoke mienta en la dirección contraria.

const DEFECTOS = {
  /** Un tipo imposible. Cualquier compilador de TypeScript lo rechaza. */
  tipo: {
    archivo: () => primerArchivo('src/app', (f) => f.endsWith('.ts') && !f.endsWith('.spec.ts')),
    inyectar: (texto) => `${texto}\nconst __smokeDefecto: number = "no soy un número";\n`,
  },
  /**
   * Una violación arquitectónica. Un componente sin OnPush es ARCH-04, que es
   * de las reglas más antiguas y menos probable que alguien desactive.
   *
   * «Menos probable» no es «imposible», y ahí estaba ACO-010: si ARCH-04 se
   * desactivara, `lint:arch` pasaría con este archivo adentro y el smoke lo
   * reportaría **decorativo** — acusando al linter de no mirar cuando el que
   * dejó de mirar es el defecto. Por eso el defecto declara de qué regla
   * depende y se comprueba contra `architect.js` antes de juzgar nada.
   */
  arquitectura: {
    regla: 'ARCH-04',
    archivo: () => path.join('src', 'app', 'features', '__smoke-defecto.component.ts'),
    crear: true,
    contenido: [
      "import { Component } from '@angular/core';",
      '',
      '// Archivo temporal del smoke: viola ARCH-04 (falta OnPush) a propósito.',
      '@Component({',
      "  selector: 'app-smoke-defecto',",
      '  standalone: true,',
      "  template: '<p>defecto</p>',",
      '})',
      'export class SmokeDefectoComponent {}',
      '',
    ].join('\n'),
  },
};

function primerArchivo(dir, filtro) {
  const pendientes = [path.join(raiz, dir)];
  while (pendientes.length > 0) {
    const actual = pendientes.shift();
    if (!fs.existsSync(actual)) continue;
    for (const nombre of fs.readdirSync(actual)) {
      const completo = path.join(actual, nombre);
      if (fs.statSync(completo).isDirectory()) { pendientes.push(completo); continue; }
      if (filtro(completo)) return path.relative(raiz, completo);
    }
  }
  return null;
}

function correr(script) {
  const inicio = Date.now();
  try {
    const salida = execFileSync(NPM, ['run', script], {
      cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10 * 60 * 1000,
    });
    return { exit: 0, salida, ms: Date.now() - inicio };
  } catch (e) {
    const salida = `${e.stdout ?? ''}${e.stderr ?? ''}`;
    return { exit: e.status ?? 1, salida, ms: Date.now() - inicio };
  }
}

/**
 * Corre el script con un defecto adentro y devuelve su exit code.
 *
 * El `finally` es la parte que importa: si esto deja un defecto puesto, rompe el
 * repositorio de quien lo corrió. Por eso el respaldo se escribe en el temp del
 * sistema y no al lado del archivo — un `.bak` olvidado en `src/` también rompe
 * el build.
 */
function provocar(script, nombreDefecto) {
  const defecto = DEFECTOS[nombreDefecto];
  if (!defecto) return null;

  const relativo = typeof defecto.archivo === 'function' ? defecto.archivo() : defecto.archivo;
  if (!relativo) return null;

  const absoluto = path.join(raiz, relativo);
  const creado = Boolean(defecto.crear);
  const respaldo = creado ? null : path.join(os.tmpdir(), `smoke-${Date.now()}.bak`);

  try {
    if (creado) {
      fs.mkdirSync(path.dirname(absoluto), { recursive: true });
      fs.writeFileSync(absoluto, defecto.contenido);
    } else {
      const original = fs.readFileSync(absoluto, 'utf8');
      fs.writeFileSync(respaldo, original);
      fs.writeFileSync(absoluto, defecto.inyectar(original));
    }
    return correr(script).exit;
  } finally {
    if (creado) {
      fs.rmSync(absoluto, { force: true });
    } else if (respaldo && fs.existsSync(respaldo)) {
      fs.copyFileSync(respaldo, absoluto);
      fs.rmSync(respaldo, { force: true });
    }
  }
}

// ─── Ejecución ───────────────────────────────────────────────────────────────

const pkg = JSON.parse(fs.readFileSync(path.join(raiz, 'package.json'), 'utf8'));
const scripts = pkg.scripts ?? {};

/**
 * ¿Sigue existiendo la regla de la que depende cada defecto? (ACO-010)
 *
 * Se deriva de `architect.js` con el mismo extractor que usa la provocación, no
 * de una lista. Si el linter no está —un proyecto donde no se copió— no se
 * inventa un veredicto: no se puede comprobar, y se dice.
 */
const rutaArchitect = path.join(raiz, 'scripts', 'architect.js');
const reglasActivas = fs.existsSync(rutaArchitect)
  ? extraerReglasRegistradas(fs.readFileSync(rutaArchitect, 'utf8'))
  : null;

function defectoInvalido(nombreDefecto) {
  const regla = DEFECTOS[nombreDefecto]?.regla;
  if (!regla) return null;
  if (reglasActivas === null) {
    return `el defecto viola ${regla} y no hay scripts/architect.js para saber si sigue activa`;
  }
  if (!reglasActivas.includes(regla)) {
    return `el defecto viola ${regla}, que ya no está registrada — no prueba nada sobre el script`;
  }
  return null;
}

console.log(`\n${c.cyan}🔥 Smoke de scripts — ¿pueden fallar, o sólo pasar?${c.reset}\n`);

// La otra mitad de ACO-010: `COMPROBACIONES` indexa por nombre exacto de
// script, y esos nombres los escribe el generador del otro lado de la frontera.
// Una entrada huérfana no rompe nada — el script cae en `sin-comprobar`, que no
// hace fallar el smoke —, así que sin esto se degrada callada.
const huerfanas = comprobacionesHuerfanas(scripts);
if (huerfanas.length > 0) {
  console.log(`${c.amarillo}❓ COMPROBACIONES declara ${huerfanas.length} script(s) que este package.json no tiene: ${huerfanas.join(', ')}${c.reset}`);
  console.log(`${c.gris}   Si el proyecto se generó sin Supabase, test:functions y check:functions no existen y está bien.${c.reset}`);
  console.log(`${c.gris}   Si es otro, alguien renombró el script y su comprobación quedó sin dueño.${c.reset}\n`);
}

const saltados = [];
const veredictos = [];
let seleccionados = 0;

for (const [nombre, comando] of Object.entries(scripts)) {
  if (solo && !solo.includes(nombre)) continue;
  seleccionados++;

  const clase = clasificar(nombre, comando);
  if (clase !== 'verificable') {
    saltados.push({ nombre, clase });
    continue;
  }

  process.stdout.write(`${c.gris}  ${nombre}…${c.reset}`);
  const limpio = correr(nombre);

  let exitProvocado;
  let invalido = null;
  const comprobacion = COMPROBACIONES[nombre];
  if (comprobacion?.modo === 'provocar') {
    invalido = defectoInvalido(comprobacion.defecto);
    if (limpio.exit === 0 && !invalido) {
      exitProvocado = provocar(nombre, comprobacion.defecto);
    }
  }

  const v = veredicto({
    nombre, exitLimpio: limpio.exit, salida: limpio.salida, exitProvocado,
    defectoInvalido: invalido,
  });
  veredictos.push({ nombre, ...v, ms: limpio.ms });

  const icono = { ok: `${c.verde}✅`, roto: `${c.rojo}🚨`, decorativo: `${c.rojo}🎭`, 'sin-comprobar': `${c.amarillo}❓` }[v.estado];
  process.stdout.write(`\r${icono} ${nombre}${c.reset} ${c.gris}— ${v.motivo} (${(limpio.ms / 1000).toFixed(1)}s)${c.reset}\n`);
}

if (saltados.length > 0) {
  console.log(`\n${c.gris}No se corren: ${saltados.map((s) => `${s.nombre} (${s.clase})`).join(', ')}${c.reset}`);
}

const r = resumir(veredictos, { scriptsEncontrados: Object.keys(scripts).length, seleccionados });
console.log('');

const decorativos = veredictos.filter((v) => v.estado === 'decorativo');
if (decorativos.length > 0) {
  console.log(`${c.rojo}🎭 ${decorativos.length} script(s) decorativos — pasan sin comprobar nada:${c.reset}`);
  for (const d of decorativos) console.log(`   ${d.nombre}: ${d.motivo}`);
  console.log(`${c.amarillo}   Un script que sale 0 sin mirar nada es peor que uno ausente: el ausente se nota.${c.reset}\n`);
}

if (r.vacio) {
  // DEC-005: acá salía `✅ 0 script(s) comprobados` con exit 0. Salir en verde
  // sin haber comprobado nada es, en pequeño, exactamente el patrón que este
  // script existe para condenar.
  console.error(`${c.rojo}❌ El smoke no comprobó nada: ${r.vacio}.${c.reset}`);
  console.error(`${c.amarillo}   Un chequeo verde que no miró nada es lo que este smoke busca.${c.reset}\n`);
  process.exit(1);
}

if (r.falla) {
  console.error(`${c.rojo}❌ Smoke falló: ${r.roto} roto(s), ${r.decorativo} decorativo(s), ${r.ok} bien.${c.reset}\n`);
  process.exit(1);
}

console.log(`${c.verde}✅ ${r.ok} script(s) comprobados${c.reset}${r['sin-comprobar'] > 0 ? `${c.gris}, ${r['sin-comprobar']} sin forma declarada de fallar${c.reset}` : ''}\n`);
