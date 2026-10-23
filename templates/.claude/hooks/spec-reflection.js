#!/usr/bin/env node
/**
 * spec-reflection.js — Stop Hook (command)
 *
 * Patron Reflection: cierra el bucle que /plan deja abierto.
 *
 * La skill /plan genera un task-spec con un "Criterio de done" en casillas
 * markdown. Hasta ahora nadie las verificaba nunca: el spec era write-only.
 * Este hook lee el task-spec activo al terminar la respuesta del agente y le
 * devuelve las casillas que siguen abiertas, con evidencia del filesystem
 * sobre las que puede comprobar por su cuenta.
 *
 * No re-evalua el codigo (eso es /review + code-judge). Solo comprueba que
 * lo que el agente declaro que iba a hacer, efectivamente lo hizo.
 *
 * Anti-bucle: el mismo spec no se reporta dos veces seguidas. Sin esto el
 * agente responde, el hook lo frena, vuelve a responder, y el hook lo frena
 * otra vez con lo mismo — un bucle que quema tokens sin avanzar.
 *
 * HUE-004: «ninguna casilla marcada» son dos situaciones, no una. Un spec recien
 * generado por /plan tambien tiene cero marcadas, y ahi callar es correcto; pero
 * doce archivos escritos con el criterio de done intacto es justo donde el aviso
 * mas falta. Lo que las separa no son las casillas, son las escrituras de la
 * sesion: sin ninguna, este hook calla.
 *
 * DERIVA DE ALCANCE: «que no agregue cosas que no pediste». El task-spec declara
 * en `## Artefactos afectados` que va a tocar; session-writes.json dice que toco.
 * Lo escrito y no declarado vuelve al agente: o es trabajo que nadie pidio, y se
 * revierte, o era parte de la tarea, y se declara y se le avisa al humano. La
 * comparacion es contra lo escrito DESDE que el spec existe: una sesion puede
 * tener varios task-specs, y lo de la tarea anterior no es deriva de esta.
 *
 * Exit codes:
 *   0 = nada que reportar
 *   2 = avisar al agente (stderr) que quedan pendientes
 */

const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
const TEMP_DIR = path.join(cwd, '.claude', 'temp');
const SEEN_FILE = path.join(TEMP_DIR, 'spec-reflection-seen.json');
const BASE_FILE = path.join(TEMP_DIR, 'spec-scope-base.json');

function bail() { process.exit(0); }

if (!fs.existsSync(TEMP_DIR)) bail();

// ─── Localizar el task-spec activo ───────────────────────────────────────────
// /plan usa timestamps YYYYMMDD-HHMMSS, asi que el orden alfabetico es
// tambien el cronologico y el ultimo del sort es el mas reciente.
let specName;
try {
  const specs = fs.readdirSync(TEMP_DIR)
    .filter(f => f.startsWith('task-spec-') && f.endsWith('.md'))
    .sort();
  specName = specs[specs.length - 1];
} catch { bail(); }

if (!specName) bail();

const specPath = path.join(TEMP_DIR, specName);

let raw;
try { raw = fs.readFileSync(specPath, 'utf-8'); } catch { bail(); }

// ─── Escrituras de la sesion ─────────────────────────────────────────────────
// Sirve para tres cosas: decidir si «ninguna casilla marcada» es un spec recien
// nacido o trabajo sin registrar, armar la evidencia sobre los indices, y
// cotejar lo escrito con lo declarado.
function escrituras() {
  try {
    const w = JSON.parse(fs.readFileSync(path.join(TEMP_DIR, 'session-writes.json'), 'utf-8'));
    return Array.isArray(w) ? w : [];
  } catch {
    return [];
  }
}
const escritas = escrituras();

// ─── Deriva de alcance: lo escrito contra `## Artefactos afectados` ──────────

/**
 * Lo que ya estaba escrito cuando este spec aparecio: una foto, tomada la
 * primera vez que este hook ve el spec. /plan termina su turno esperando la
 * aprobacion del humano, asi que la foto es anterior al codigo de la tarea.
 *
 * No se usa el timestamp del nombre: el agente puede escribirlo en UTC o en
 * hora local, y en una zona detras de UTC la tarea entera quedaria «antes» del
 * spec — el chequeo callaria siempre, justo donde se lo necesita.
 */
function previas() {
  try {
    const b = JSON.parse(fs.readFileSync(BASE_FILE, 'utf-8'));
    if (b && b.spec === specName && Array.isArray(b.previas)) return new Set(b.previas);
  } catch { /* primera vez que se ve este spec */ }
  try {
    fs.writeFileSync(BASE_FILE, JSON.stringify({ spec: specName, previas: escritas }, null, 2));
  } catch { /* fail-open */ }
  return new Set(escritas);
}

/**
 * Las rutas que el spec declara: las que van entre backticks en la seccion.
 * `null` si el spec no tiene la seccion (no declara nada que cotejar); el
 * ejemplo de la plantilla —`src/app/features/...`— no cuenta como declaracion.
 */
function declarados(md) {
  const sec = /^##\s+Artefactos afectados[ \t]*$([\s\S]*?)(?=^##\s|(?![\s\S]))/m.exec(md);
  if (!sec) return null;
  return [...sec[1].matchAll(/`([^`\s]+)`/g)]
    .map((m) => m[1].replace(/^\.\//, ''))
    .filter((r) => r.includes('/') && !r.includes('...') && !r.includes('…'));
}

function globARegex(glob) {
  const re = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '(?:[^/]+/)*');
  return new RegExp(`^${re}$`);
}

/**
 * ¿Lo declarado cubre lo escrito? Una carpeta cubre lo que tiene adentro, un
 * glob lo que matchea, y un archivo cubre a sus hermanos de nombre: declarar
 * `x.component.ts` cubre `x.component.html` y `x.component.scss`.
 */
function cubre(declarado, escrito) {
  if (escrito === declarado) return true;
  if (declarado.includes('*')) return globARegex(declarado).test(escrito);
  if (declarado.endsWith('/') || !path.posix.extname(declarado)) {
    return escrito.startsWith(declarado.replace(/\/?$/, '/'));
  }
  const base = declarado.replace(/\.[^./]+$/, '');
  return path.posix.dirname(escrito) === path.posix.dirname(declarado) && escrito.startsWith(`${base}.`);
}

const yaEstaban = previas();
const decl = declarados(raw);
const deriva = decl === null
  ? []
  : escritas.filter((w) => !yaEstaban.has(w) && !decl.some((d) => cubre(d, w)));

// ─── Extraer casillas ────────────────────────────────────────────────────────
const open = [];
let done = 0;
for (const line of raw.split('\n')) {
  if (/^\s*-\s*\[x\]/i.test(line)) { done++; continue; }
  const m = line.match(/^\s*-\s*\[ \]\s*(.+)$/);
  if (m) open.push(m[1].trim());
}

// Spec completo y sin deriva: limpiar la memoria de avisos para el proximo spec.
if (open.length === 0 && deriva.length === 0) {
  try { fs.unlinkSync(SEEN_FILE); } catch { /* ignore */ }
  bail();
}

// HUE-004 — «ninguna casilla marcada» no es una sola situacion.
//
// El hook callaba ante `done === 0` razonando «el agente no adopto el flujo».
// Pero eso tapa el caso donde el aviso mas falta: doce archivos escritos y el
// criterio de done intacto. Lo que distingue una cosa de la otra no son las
// casillas, es si hubo trabajo: un spec recien generado por /plan tambien tiene
// cero marcadas, y ahi callar es correcto.
const nadaMarcado = done === 0;
if (nadaMarcado && escritas.length === 0) bail();

// ─── Anti-bucle: no repetir el mismo aviso ───────────────────────────────────
const signature = `${specName}:${open.length}:${done}:${deriva.join(',')}`;
try {
  if (fs.existsSync(SEEN_FILE)) {
    const seen = JSON.parse(fs.readFileSync(SEEN_FILE, 'utf-8'));
    if (seen.signature === signature) bail();
  }
} catch { /* fail-open */ }

try {
  fs.writeFileSync(SEEN_FILE, JSON.stringify({ signature, at: new Date().toISOString() }, null, 2));
} catch { /* fail-open */ }

// ─── Evidencia comprobable del filesystem ────────────────────────────────────
// Para las casillas que mencionan indices, el hook puede verificar por su
// cuenta si hubo escritura reciente y decirselo al agente.
const evidence = [];
try {
  const indexDir = path.join(cwd, 'indices');
  if (fs.existsSync(indexDir)) {
    const writes = escritas;
    if (writes.length > 0) {
      let lastIndexMtime = 0;
      for (const f of fs.readdirSync(indexDir).filter(f => f.endsWith('.md'))) {
        const st = fs.statSync(path.join(indexDir, f));
        if (st.mtimeMs > lastIndexMtime) lastIndexMtime = st.mtimeMs;
      }
      const stale = writes.filter(w => {
        const abs = path.isAbsolute(w) ? w : path.join(cwd, w);
        try { return fs.statSync(abs).mtimeMs > lastIndexMtime; } catch { return false; }
      });
      if (stale.length > 0) {
        evidence.push(`${stale.length} archivo(s) fuente son mas recientes que el ultimo indice — la casilla de indices sigue sin cumplirse de verdad.`);
      }
    }
  }
} catch { /* fail-open */ }

// ─── Reportar ────────────────────────────────────────────────────────────────
// Dos situaciones distintas, dos encabezados distintos: el que viene marcando
// casillas necesita saber que le falta; el que escribio sin marcar ninguna
// necesita saber que el criterio de done sigue intacto (HUE-004).
const pendientes = open.length === 0 ? '' : (nadaMarcado
  ? `\u{1F9ED} SPEC REFLECTION: ${escritas.length} archivo(s) escrito(s) y ninguna casilla marcada en ${specName}.\n`
    + `   Los ${open.length} punto(s) del criterio de done siguen igual que cuando /plan lo genero.\n\n`
  : `\u{1F9ED} SPEC REFLECTION: ${specName} tiene ${open.length} punto(s) sin cerrar (${done} completado(s)).\n\n`)
  + open.map(t => `  ☐ ${t}`).join('\n') + '\n\n'
  + (evidence.length > 0 ? evidence.map(e => `  ⚠️  ${e}`).join('\n') + '\n\n' : '')
  + `Para cada punto abierto, elige una:\n`
  + `  1. Cumplirlo ahora.\n`
  + `  2. Marcarlo [x] en ${specName} si ya esta hecho y solo faltaba registrarlo.\n`
  + `  3. Decirle al humano por que queda fuera de alcance.\n\n`
  + `No cierres la tarea dejando el criterio de done a medias en silencio.\n`;

const fueraDeAlcance = deriva.length === 0 ? '' :
  `\u{1F9ED} SPEC REFLECTION: escribiste ${deriva.length} archivo(s) que ${specName} no declara en "## Artefactos afectados":\n`
  + deriva.map(w => `  ✗ ${w}`).join('\n') + '\n'
  + (decl.length === 0 ? '  (la tabla sigue con el ejemplo de la plantilla: no declara nada)\n' : '')
  + `\nPara cada uno, elige una:\n`
  + `  1. Es trabajo que nadie pidio: revertilo.\n`
  + `  2. Es parte de la tarea: agregalo a la tabla Y decile al humano por que entro.\n`
  + `Lo que no se declara no se revisa: asi es como entra lo que nadie pidio.\n`;

process.stderr.write(
  [pendientes, fueraDeAlcance].filter(Boolean).join('\n') + '\n'
  + `Este aviso no se repite para el mismo estado del spec — si no cambia nada, no vuelve a salir.`
);
process.exit(2);
