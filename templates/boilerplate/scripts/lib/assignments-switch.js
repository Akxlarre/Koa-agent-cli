/**
 * assignments-switch.js — El interruptor de la capa de asignaciones.
 *
 * La capa entera —dos scripts, tres comandos `/assign-*`, `ASSIGNMENTS.md`— se
 * enciende con la presencia de `specs/AUTHORS.md`. Un solo hecho gobierna las
 * tres decisiones que antes estaban tomadas por separado y en desacuerdo:
 *
 *   ¿los scripts hacen algo?              apagada → mensaje y exit 0
 *   ¿los IDs llevan código de autor?      apagada → NNNN-slug
 *   ¿los comandos ofrecen el flujo?       apagada → avisan que está apagada
 *
 * El principio no es nuevo: lo escribió el propio scaffolder tres líneas encima
 * de donde faltaban estos npm scripts, para `lint:specs` —
 *
 *   «Sin carpeta specs/ no hace nada, igual que el spec-gate: el SDD viene
 *    dormido y no molesta a quien no lo usa.»
 *
 * — y los dos scripts de asignaciones eran los únicos del blueprint que no lo
 * cumplían: sin `ASSIGNMENTS.md` salían en `exit 1` y ponían rojo el CI de un
 * proyecto que jamás pidió la capa (INC-010).
 *
 * **Por qué `AUTHORS.md` y no `ASSIGNMENTS.md`.** El código de autor existe para
 * que dos ramas no saquen el mismo número y git las auto-resuelva sin conflicto.
 * Ese riesgo aparece cuando hay más de un autor, que es justamente lo que
 * declara `AUTHORS.md`. `ASSIGNMENTS.md` es el tablero; `AUTHORS.md` es el hecho.
 *
 * Ver docs/diseno/ADR-004.
 *
 * Micro-suite: `node --test scripts/lib/assignments-switch.test.mjs`
 */

import fs from 'fs';
import path from 'path';

/** Los tres motivos por los que un script de esta capa termina. */
export const APAGADA = 'apagada';
export const SANA = 'sana';
export const ROTA = 'rota';

/** ¿La capa está encendida en este proyecto? */
export function capaEncendida(specsDir) {
    try {
        return fs.existsSync(path.join(specsDir, 'AUTHORS.md'));
    } catch {
        return false;
    }
}

/**
 * Los códigos de autor declarados en `AUTHORS.md`, como Set.
 * Vacío si el archivo no está o no tiene tabla — el llamador decide qué hacer.
 */
export function autoresDeclarados(specsDir) {
    const codigos = new Set();
    try {
        const md = fs.readFileSync(path.join(specsDir, 'AUTHORS.md'), 'utf-8');
        for (const m of md.matchAll(/^\|\s*`([a-z]+)`\s*\|/gm)) codigos.add(m[1]);
    } catch { /* capa apagada */ }
    return codigos;
}

/**
 * El regex del nombre de un track, en la forma que ESTE proyecto usa.
 *
 * INC-017 — el auditor exigía `<tipo>-NNN-<autor>-slug` siempre, y los tres
 * comandos normales del SDD (`/spec-new`, `/fix-new`, `/hotfix`) generan sin
 * código de autor. Es decir: **todo track creado por el flujo normal era una
 * violación de naming.** No un caso borde: el caso común.
 *
 * Las dos formas son válidas; cuál vale en este proyecto lo dice el interruptor.
 * Se descarta poner el código de autor siempre porque obligaría a declararlo en
 * cada proyecto de una sola persona —la mayoría— para prevenir una colisión que
 * ahí no puede ocurrir.
 */
export function regexDeTrack(prefix, numDigits, { conAutor }) {
    const num = `(\\d{${numDigits}})`;
    const autor = conAutor ? '([a-z]+)-' : '';
    return prefix
        ? new RegExp(`^${prefix}-${num}-${autor}(.+)$`)
        : new RegExp(`^${num}-${autor}(.+)$`);
}

/**
 * Parsea el nombre de un directorio de track.
 * @returns {{ number: string, author: string|null, slug: string } | null}
 */
export function parseTrackName(prefix, name, numDigits, { conAutor }) {
    const m = String(name).match(regexDeTrack(prefix, numDigits, { conAutor }));
    if (!m) return null;
    return conAutor
        ? { number: m[1], author: m[2], slug: m[3] }
        : { number: m[1], author: null, slug: m[2] };
}

/** El formato que este proyecto espera, para ponerlo en un mensaje de error. */
export function formatoEsperado(prefix, conAutor) {
    const base = conAutor ? 'NNN-<autor>-slug' : 'NNN-slug';
    return prefix ? `${prefix}-${base}` : base.replace('NNN', 'NNNN');
}

/**
 * Lo que un script de esta capa imprime cuando la capa está apagada.
 *
 * Es un mensaje, no un error: DUP-001 era que `assignments-sync` no distinguía
 * «no hay nada que hacer» de «hay algo roto». `verificar-specs.mjs` ya hacía esa
 * distinción y es el modelo.
 */
export function avisoApagada(nombreScript) {
    return (
        `\x1b[2m${nombreScript}: la capa de asignaciones está apagada ` +
        '(no existe specs/AUTHORS.md).\n' +
        '  Se enciende creando specs/AUTHORS.md con la tabla de códigos de autor.\n' +
        '  Ver .claude/skills/sdd/SKILL.md § Asignaciones.\x1b[0m'
    );
}
