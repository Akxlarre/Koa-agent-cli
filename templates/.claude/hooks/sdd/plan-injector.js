#!/usr/bin/env node
/**
 * plan-injector.js — PreToolUse Hook (Edit|Write|MultiEdit)
 *
 * Si hay una spec SDD activa y el archivo a tocar es codigo de produccion,
 * inyecta el contenido de spec.md + plan.md + tasks.md como additionalContext
 * para que Claude trabaje con el contrato vivo.
 *
 * Se ejecuta DESPUES de spec-gate.js. Si el gate no bloqueo, este inyecta.
 *
 * Exit code 0 siempre (este hook nunca bloquea; solo enriquece contexto).
 *
 * CAR-001 (S1) — habia tope por seccion pero NINGUNA dedup: cada Edit pagaba el
 * contrato entero otra vez. Medido, diez ediciones con la misma spec activa
 * daban 246.220 chars identicos byte por byte. Ahora pasa por lib/budget.js, que
 * dedupica por CONTENIDO: si la spec cambia se vuelve a emitir, porque es
 * informacion nueva; si no cambio, no.
 *
 * La dedup vive en ambito de HILO (ADR-003 §1) y compact-recovery la olvida al
 * compactar, que es cuando el agente realmente perdio el contrato.
 */

const fs = require('fs');
const path = require('path');
const payload = require('./../lib/payload.js');
const paths = require('./../lib/paths.js');
const budget = require('./../lib/budget.js');

const MAX_SECTION_CHARS = 8000;

function readCapped(filePath, label) {
  if (!fs.existsSync(filePath)) return '';
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.length > MAX_SECTION_CHARS) {
    content = content.slice(0, MAX_SECTION_CHARS) + '\n\n... [truncado a ' + MAX_SECTION_CHARS + ' chars]';
  }
  return '\n\n----- ' + label + ' (' + path.basename(filePath) + ') -----\n' + content;
}

payload.read().then((input) => {
  try {
    const filePath = input.filePath;
    if (!filePath) return process.exit(0);

    const cwd = input.cwd;
    const specsDir = path.join(cwd, 'specs');
    if (!fs.existsSync(specsDir)) return process.exit(0);

    // La misma respuesta que da spec-gate. Antes cada uno llevaba su lista de
    // exentos y divergian: src/guia.mdx pasaba el gate y aun asi recibia el
    // contrato entero. Ver lib/paths.js.
    if (!paths.isProductCode(filePath, cwd)) return process.exit(0);

    const activeFile = path.join(specsDir, '.active');
    if (!fs.existsSync(activeFile)) return process.exit(0);

    const activeId = fs.readFileSync(activeFile, 'utf8').trim().split('\n')[0].trim();
    if (!activeId || activeId.startsWith('--bypass')) return process.exit(0);

    const subdir = activeId.startsWith('hotfix-')
      ? 'hotfixes'
      : activeId.startsWith('fix-')
        ? 'fixes'
        : 'specs';
    const itemDir =
      [
        path.join(specsDir, subdir, activeId),
        path.join(specsDir, activeId), // legacy spec/fix
        path.join(specsDir, 'fixes', 'hotfixes', activeId), // legacy hotfix
      ].find((d) => fs.existsSync(d)) || path.join(specsDir, subdir, activeId);
    if (!fs.existsSync(itemDir)) return process.exit(0);

    let context;

    // Hotfix track: inyectar solo hotfix.md (no tiene spec/plan/tasks)
    if (activeId.startsWith('hotfix-')) {
      context = '\u{1F525} HOTFIX TRACK - Hotfix activo: ' + activeId;
      context += readCapped(path.join(itemDir, 'hotfix.md'), 'HOTFIX (contrato)');
      context += '\n\n----- INSTRUCCIONES -----\n' +
        '1. El cambio debe limitarse a lo declarado en hotfix.md (Problema + Cambios).\n' +
        '2. Un hotfix es para cuando el \"como\" es obvio. Si aparece una decision de diseno -> DETENETE y abri /fix-new o /spec-new.\n' +
        '3. No cambia contratos publicos ni BD. Si tu cambio los toca, no es un hotfix.\n' +
        '4. Este track se auto-cierra al terminar la sesion.\n';
    } else if (activeId.startsWith('fix-')) {
      context = '\u{1F527} FIX TRACK - Fix activo: ' + activeId;
      context += readCapped(path.join(itemDir, 'fix.md'), 'FIX (contrato)');
      context += '\n\n----- INSTRUCCIONES -----\n' +
        '1. El cambio debe limitarse estrictamente a lo declarado en fix.md (Root Cause + Cambio).\n' +
        '2. Si descubris scope adicional durante la implementacion -> DETENETE, avisale al usuario y crea una spec/fix nuevo.\n' +
        '3. El test de regresion mencionado en fix.md DEBE quedar verde antes de correr /fix-close.\n' +
        '4. Un fix = una causa raiz = un archivo tocado. Si necesitas tocar mas, revisá si es un fix o una spec.\n';
    } else {
      // Spec track: inyectar spec + plan + tasks
      context = '\u{1F4CB} SDD CONTEXT - Spec activa: ' + activeId;
      context += readCapped(path.join(itemDir, 'spec.md'), 'SPEC (contrato)');
      context += readCapped(path.join(itemDir, 'plan.md'), 'PLAN (como)');
      context += readCapped(path.join(itemDir, 'tasks.md'), 'TASKS (estado)');
      context += '\n\n----- INSTRUCCIONES -----\n' +
        '1. Cada cambio que hagas debe mapear a un AC de la SPEC o a una tarea de TASKS.\n' +
        '2. Si lo que vas a escribir esta fuera del scope declarado -> DETENETE y avisale al usuario.\n' +
        '3. Si descubris una tarea no listada que SI esta en scope -> agregala a su slice en tasks.md antes de hacerla.\n' +
        '4. Un slice a la vez: test en rojo commiteado, verde, usarlo (verify), /review, commit. No arranques el siguiente con este sin usar.\n' +
        '5. Al cerrar la spec corre /spec-verify para validar AC contra evidencia.\n';
    }

    // CAR-001: si es lo mismo que ya se dijo en este hilo, no se repite.
    const aEmitir = budget.inject(input, 'plan-sdd', context, { cutAt: null });
    if (!aEmitir) return process.exit(0);

    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext: aEmitir,
      },
    }));
    process.exit(0);
  } catch (e) {
    process.exit(0);
  }
});