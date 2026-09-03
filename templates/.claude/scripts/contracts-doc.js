#!/usr/bin/env node
/**
 * contracts-doc.js — `docs/CONTRATOS.md`, generado desde el registro (ACO-013)
 *
 * El harness tiene artefactos que una pieza escribe y otra lee. La auditoría
 * encontró 21 y **3 declarados**, y la declaración —`templates-contract.md`—
 * vive en el repo del CLI, no acá: un agente trabajando en un proyecto generado
 * no tenía forma de saber que `sync-check` borraba el archivo del que depende
 * `spec-diff-check`.
 *
 * `.claude/hooks/lib/contracts.js` cerró la primera mitad: los artefactos son
 * datos, y un test los contrasta contra el filesystem. Pero es un módulo
 * CommonJS que nadie lee para orientarse. Esto cierra la otra mitad — la misma
 * verdad, en la forma en que se consulta.
 *
 * Se genera, no se escribe: entre los marcadores `AUTO-GENERATED` (el patrón de
 * `indices-sync` y `assignments-sync`) y con un test que falla si el archivo y
 * el registro se separan. Una tabla escrita a mano vuelve a desactualizarse —
 * es literalmente el hallazgo que este archivo cierra.
 *
 *   node .claude/scripts/contracts-doc.js            escribe docs/CONTRATOS.md
 *   node .claude/scripts/contracts-doc.js --check    sale en 1 si está desfasado
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { CONTRACTS } = require('../hooks/lib/contracts.js');

const INICIO = '<!-- AUTO-GENERATED:BEGIN -->';
const FIN = '<!-- AUTO-GENERATED:END -->';
const DESTINO = path.join(process.cwd(), 'docs', 'CONTRATOS.md');

const CABECERA = `# Contratos del harness

> **Generado** desde \`.claude/hooks/lib/contracts.js\` con \`npm run contracts:doc\`.
> Lo que está entre los marcadores \`AUTO-GENERATED\` se reescribe entero; lo de
> afuera se conserva. Si agregás un artefacto compartido, declaralo en el registro
> y volvé a generar — no edites la tabla.

Un **contrato** acá es un archivo o un formato que una pieza escribe y otra lee.
Ninguno lo impone el lenguaje: son acuerdos que se sostienen porque alguien los
respeta. Los dos campos que más cuesta adivinar leyendo el código:

- **lifetime** — cuándo se borra: \`turno\`, \`sesion\`, \`permanente\`.
- **scope** — quién lo comparte: \`sesion\` (todo el trabajo), \`hilo\` (el agente
  principal y cada subagente por separado), \`proyecto\` (vive en el repo).

`;

/** Escapa lo que rompería una celda de tabla markdown. */
const celda = (t) => String(t ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

/** Una lista de piezas como código, o «—» si no hay ninguna. */
const piezas = (xs) => (xs && xs.length
  ? xs.map((p) => (p.startsWith('<') ? `*${celda(p.slice(1, -1))}*` : `\`${celda(p)}\``)).join('<br>')
  : '—');

function render() {
  const filas = Object.entries(CONTRACTS).map(([id, c]) => '| '
    + [
      `\`${celda(id)}\``,
      `\`${celda(c.path)}\``,
      piezas(c.producers),
      piezas(c.consumers),
      celda(c.lifetime),
      celda(c.scope),
    ].join(' | ') + ' |');

  const notas = Object.entries(CONTRACTS)
    .filter(([, c]) => c.nota)
    .map(([id, c]) => `### \`${id}\`\n\n${c.format ? `**Formato:** ${c.format}\n\n` : ''}${c.nota}\n`);

  return [
    `**${Object.keys(CONTRACTS).length} artefactos declarados.**`,
    '',
    '| Artefacto | Ruta | Lo escribe | Lo lee | lifetime | scope |',
    '|---|---|---|---|---|---|',
    ...filas,
    '',
    '## Por qué cada uno es como es',
    '',
    ...notas,
  ].join('\n');
}

/** Conserva todo lo que esté fuera de los marcadores. */
function componer(previo) {
  const cuerpo = `${INICIO}\n${render()}\n${FIN}\n`;
  if (!previo) return `${CABECERA}${cuerpo}`;

  const a = previo.indexOf(INICIO);
  const b = previo.indexOf(FIN, a);
  if (a === -1 || b === -1) return `${CABECERA}${cuerpo}`;
  return `${previo.slice(0, a)}${cuerpo}${previo.slice(b + FIN.length).replace(/^\n/, '')}`;
}

const previo = fs.existsSync(DESTINO) ? fs.readFileSync(DESTINO, 'utf-8') : '';
const nuevo = componer(previo);

if (process.argv.includes('--check')) {
  if (previo === nuevo) {
    console.log('docs/CONTRATOS.md está al día.');
    process.exit(0);
  }
  console.error('docs/CONTRATOS.md quedó desfasado del registro. Corré: npm run contracts:doc');
  process.exit(1);
}

fs.mkdirSync(path.dirname(DESTINO), { recursive: true });
fs.writeFileSync(DESTINO, nuevo);
console.log(`docs/CONTRATOS.md — ${Object.keys(CONTRACTS).length} artefactos.`);
