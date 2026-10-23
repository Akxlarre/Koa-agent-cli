#!/usr/bin/env node
/**
 * commit-guard.js — PreToolUse Hook (Bash — detecta git commit)
 *
 * Lo que un commit del agente puede llevar. Dos reglas, y las dos salen de cómo
 * se pierde el control cuando una IA programa en pasos grandes:
 *
 *   COMMIT-01  Un commit que cambia código de producto NO cambia además las
 *              aserciones de un test que ya estaba en HEAD, ni le agrega
 *              `.skip` / `.only`. Es la trampa más barata para llegar a verde:
 *              tocar el test en el mismo commit que el código, donde el diff no
 *              lo deja ver. El test en rojo se commitea solo (el S·.1 de cada
 *              slice); desde ahí, cambiarlo es un commit aparte y visible.
 *
 *   COMMIT-02  Un commit no lleva más de LIMITE_LINEAS líneas de código de
 *              producto. Un diff de miles de líneas no se revisa: se acepta.
 *              Se entrega por slices, y un slice entra en un `/review`.
 *
 * Qué NO frena, a propósito:
 *   - un commit que solo toca tests (cambiar un test a la vista es legítimo);
 *   - agregar tests nuevos, o casos nuevos a un archivo existente;
 *   - el primer commit del repo, y los merges, rebases y cherry-picks: traen
 *     trabajo ya hecho, no un slice;
 *   - al humano. Un hook de Claude Code intercepta las herramientas del agente,
 *     no la terminal de la persona: la salida para un caso legítimo —un renombre
 *     mecánico de 600 líneas, un refactor que cambia la API y el test con ella—
 *     es que el humano haga ese commit. Es la misma salida que el Approval Gate
 *     de `bash-guard` le da a `supabase db push`.
 *
 * Qué entra en el commit se calcula ANTES de que corra el comando: un
 * `git add -A && git commit` todavía no stageó nada cuando este hook lo ve. Por
 * eso se miran los `git add` del mismo comando y `-a`/`--all` del commit.
 *
 * Exit codes:
 *   0 = permitir el commit (o no es un commit, o no se pudo leer: fail-open)
 *   2 = bloquear el commit, con qué hacer
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const payload = require('./lib/payload.js');
const paths = require('./lib/paths.js');

/** COMMIT-02. Un `generate feature` entero son ~250 líneas sin sus specs. */
const LIMITE_LINEAS = 400;

const ES_TEST = /\.(?:spec|test)\.[cm]?[jt]sx?$/;
/** Lo que, quitado o cambiado, cambia lo que un test exige. */
const ASERCION = /\bexpect\s*\(|\bassert\b|\.to[A-Z]\w*\s*\(|\b(?:it|test|describe)\s*\(/;
/** Lo que, agregado, apaga un test sin borrarlo. */
const DESACTIVA = /\b(?:it|test|describe)\.(?:skip|only|todo)\s*\(|\bx(?:it|describe|test)\s*\(/;
/** Generado por una herramienta, no escrito: no cuenta para el tamaño. */
const GENERADO = /(?:^|\/)(?:supabase|database)\.types\.ts$|\.d\.ts$/;

const COMMIT = /(?:^|&&|\|\||;|\||\(|\n)\s*(?:[A-Za-z_]\w*=\S*\s+)*git\s+((?:(?:-C|-c)\s+\S+\s+|--[\w-]+(?:=\S+)?\s+)*)commit\b([^&|;\n]*)/;
const ADD = /(?:^|&&|\|\||;|\||\(|\n)\s*git\s+(?:(?:-C|-c)\s+\S+\s+)*add\b([^&|;\n]*)/g;

function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return r.error || r.status !== 0 ? null : r.stdout;
}

const tokens = (s) => (s.match(/"[^"]*"|'[^']*'|\S+/g) || []).map((t) => t.replace(/^["']|["']$/g, ''));

/**
 * Qué va a entrar en el commit, leído del comando. `null` si no es un commit.
 *
 *   todo        `-a` en el commit, o `git add -A|.|-u` antes en el mismo comando
 *   rutas       `git add <rutas>` antes en el mismo comando
 *   soloTracked `-a` y `add -u` no suman archivos nuevos
 */
function alcance(cmd) {
  const m = COMMIT.exec(cmd);
  if (!m) return null;
  const opcionesGit = tokens(m[1]);
  const args = tokens(m[2]);
  if (args.includes('--dry-run') || args.includes('-h') || args.includes('--help')) return null;

  const iC = opcionesGit.indexOf('-C');
  const dir = iC !== -1 ? opcionesGit[iC + 1] : null;
  const commitTodo = args.some((a) => a === '--all' || /^-[a-zA-Z]*a[a-zA-Z]*$/.test(a));

  let todo = commitTodo;
  let soloTracked = commitTodo;
  const rutas = [];
  for (const a of cmd.slice(0, m.index + m[0].length).matchAll(ADD)) {
    const ts = tokens(a[1]);
    if (ts.some((t) => ['-A', '--all', '.', ':/', '*'].includes(t))) { todo = true; soloTracked = false; continue; }
    if (ts.some((t) => t === '-u' || t === '--update')) { todo = true; continue; }
    rutas.push(...ts.filter((t) => !t.startsWith('-')));
  }
  return { dir, todo, soloTracked: soloTracked && rutas.length === 0, rutas };
}

/** ¿Hay algo que juzgar? No en el primer commit ni a mitad de un merge o rebase. */
function juzgable(cwd) {
  if (git(cwd, ['rev-parse', '--verify', '--quiet', 'HEAD']) === null) return false;
  const gitDir = (git(cwd, ['rev-parse', '--git-dir']) || '').trim();
  if (!gitDir) return false;
  const abs = path.resolve(cwd, gitDir);
  return !['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply']
    .some((f) => fs.existsSync(path.join(abs, f)));
}

/**
 * ruta → { mas, menos, base } de lo que va a entrar en el commit.
 *
 * Rutas relativas al proyecto (`--relative`), no a la raíz del repo: en un monorepo
 * con la app en una subcarpeta, `frontend/src/app/x.ts` no es «código de producto»
 * para lib/paths.js, y el guard callaría sobre todo.
 */
function cambios(cwd, alc) {
  const mapa = new Map();
  const cargar = (salida, base) => {
    for (const linea of String(salida || '').split('\n')) {
      const [a, b, ruta] = linea.split('\t');
      if (!ruta) continue;
      mapa.set(ruta, { mas: a === '-' ? 0 : Number(a), menos: b === '-' ? 0 : Number(b), base });
    }
  };
  cargar(git(cwd, ['diff', '--cached', '--numstat', '--no-renames', '--relative']), '--cached');

  if (alc.todo || alc.rutas.length > 0) {
    const filtro = alc.todo ? [] : ['--', ...alc.rutas];
    cargar(git(cwd, ['diff', 'HEAD', '--numstat', '--no-renames', '--relative', ...filtro]), 'HEAD');
    if (!alc.soloTracked) {
      const nuevos = git(cwd, ['ls-files', '--others', '--exclude-standard', ...filtro]) || '';
      for (const ruta of nuevos.split('\n').filter(Boolean)) {
        let lineas = 0;
        try { lineas = fs.readFileSync(path.join(cwd, ruta), 'utf8').split('\n').length; } catch { /* */ }
        mapa.set(ruta, { mas: lineas, menos: 0, base: null });
      }
    }
  }
  return mapa;
}

/** COMMIT-01 sobre un test: qué aserciones quita o cambia, y qué apaga. */
function tocaAserciones(cwd, ruta, base) {
  if (!base) return null; // archivo nuevo: no había nada que cambiar
  if (git(cwd, ['cat-file', '-e', `HEAD:./${ruta}`]) === null) return null;
  const diff = git(cwd, base === 'HEAD'
    ? ['diff', 'HEAD', '-U0', '--no-renames', '--', ruta]
    : ['diff', '--cached', '-U0', '--no-renames', '--', ruta]) || '';
  const lineas = diff.split('\n');
  const quitadas = lineas
    .filter((l) => l.startsWith('-') && !l.startsWith('---'))
    .map((l) => l.slice(1).trim())
    .filter((l) => ASERCION.test(l));
  const apagadas = lineas
    .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
    .map((l) => l.slice(1).trim())
    .filter((l) => DESACTIVA.test(l));
  return quitadas.length || apagadas.length ? { ruta, quitadas, apagadas } : null;
}

function revisar(cwd, alc) {
  const mapa = cambios(cwd, alc);
  const rutas = [...mapa.keys()];
  const producto = rutas.filter((r) => !ES_TEST.test(r) && paths.isProductCode(path.join(cwd, r), cwd));
  const violaciones = [];

  // ─── COMMIT-01 ────────────────────────────────────────────────────────────
  if (producto.length > 0) {
    const tocados = rutas
      .filter((r) => ES_TEST.test(r))
      .map((r) => tocaAserciones(cwd, r, mapa.get(r).base))
      .filter(Boolean);
    if (tocados.length > 0) {
      violaciones.push(
        '\u{1F9EA} COMMIT GUARD [COMMIT-01]: este commit cambia tests que ya existian, junto con codigo de producto.\n'
        + tocados.map((t) => `  - ${t.ruta}`
          + (t.quitadas.length ? `\n      quita o cambia ${t.quitadas.length} asercion(es): ${t.quitadas.slice(0, 3).join('  |  ')}` : '')
          + (t.apagadas.length ? `\n      apaga tests: ${t.apagadas.slice(0, 3).join('  |  ')}` : '')).join('\n')
        + '\n\nAsi es como un test "pasa": se lo cambia en el mismo commit que el codigo, y en el diff no se ve.\n'
        + 'Que hacer:\n'
        + '  1. Si el test estaba bien, devolvelo a como estaba (git restore --staged --worktree <archivo>) y arregla el codigo.\n'
        + '  2. Si el test estaba mal, commitealo SOLO, sin codigo de producto, y decile al humano que cambio y por que.\n'
        + '  3. Si es un refactor que cambia la API y el test con ella, pedile al humano que haga el commit.',
      );
    }
  }

  // ─── COMMIT-02 ────────────────────────────────────────────────────────────
  const contables = producto.filter((r) => !GENERADO.test(r));
  const total = contables.reduce((n, r) => n + mapa.get(r).mas + mapa.get(r).menos, 0);
  if (total > LIMITE_LINEAS) {
    violaciones.push(
      `\u{1F4CF} COMMIT GUARD [COMMIT-02]: este commit lleva ${total} lineas de codigo de producto `
      + `(tope ${LIMITE_LINEAS}) en ${contables.length} archivo(s).\n`
      + 'Un diff asi no se revisa: se acepta. Partilo por slice — un commit por cada porcion que se pueda\n'
      + 'usar y revisar con /review. No cuentan tests, docs, indices, config ni tipos generados.\n'
      + 'Si de verdad es una unidad (un renombre mecanico, codigo generado), pedile al humano que haga el commit.',
    );
  }
  return violaciones;
}

if (require.main === module) {
  payload.read().then((input) => {
    try {
      const alc = alcance(input.command || '');
      if (!alc) return process.exit(0);
      const cwd = alc.dir ? path.resolve(input.cwd, alc.dir) : input.cwd;
      if (!juzgable(cwd)) return process.exit(0);

      const violaciones = revisar(cwd, alc);
      if (violaciones.length === 0) return process.exit(0);

      process.stderr.write(violaciones.join('\n\n')
        + '\n\nDoc: docs/HOOKS-SYSTEM.md#commit-guard');
      process.exit(2);
    } catch {
      process.exit(0); // fail-open: un hook nunca frena por no saber leerse
    }
  });
}

module.exports = { alcance, LIMITE_LINEAS, ASERCION, DESACTIVA };
