#!/usr/bin/env node
/**
 * hotfix-autoclose.js — SessionEnd Hook (command)
 *
 * Si al terminar la sesión el track activo sigue siendo un hotfix-NNN-slug, lo
 * cierra:
 *   1. Marca hotfix.md status: done + agrega closed: <fecha>
 *   2. Limpia specs/.active
 *
 * INC-007 — este hook vivía en `Stop`, y `Stop` corre al final de cada
 * RESPUESTA, no de la sesión. El hotfix se cerraba en el primer turno, con el
 * trabajo empezando; y desde ahí `spec-gate` bloqueaba cada escritura pidiendo
 * la spec que este hook acababa de borrar. El auto-cierre nunca estuvo mal como
 * idea: estaba enganchado al evento equivocado.
 *
 * Ahora es una RED DE SEGURIDAD, no el camino principal. El camino principal es
 * `/hotfix-close`, simétrico con `/fix-close`: quien sabe si el trabajo terminó
 * es quien lo hizo. Esto solo recoge el track que quedó abierto porque alguien
 * se olvidó de cerrarlo — sin esto, `specs/.active` queda sucio para la sesión
 * siguiente (ADR-002 §3).
 *
 * Diseño: fail-open. Si algo falla, no bloquea el cierre de sesión.
 */

const fs = require('fs');
const path = require('path');
const payload = require('../lib/payload.js');

payload.read().then((PAYLOAD) => {
  try {
    const cwd = PAYLOAD.cwd;
    const specsDir = path.join(cwd, 'specs');
    const activeFile = path.join(specsDir, '.active');

    if (!fs.existsSync(activeFile)) return process.exit(0);

    const activeId = fs.readFileSync(activeFile, 'utf8').trim().split('\n')[0].trim();

    if (!activeId.startsWith('hotfix-')) return process.exit(0);

    // Ubicar hotfix.md
    const hotfixDir =
      [
        path.join(specsDir, 'hotfixes', activeId),
        path.join(specsDir, 'fixes', 'hotfixes', activeId), // legacy pre-migracion
      ].find((d) => fs.existsSync(path.join(d, 'hotfix.md'))) ||
      path.join(specsDir, 'hotfixes', activeId);
    const hotfixMd = path.join(hotfixDir, 'hotfix.md');

    if (fs.existsSync(hotfixMd)) {
      const today = new Date().toISOString().split('T')[0];
      let content = fs.readFileSync(hotfixMd, 'utf8');

      // Actualizar status
      content = content.replace(/^> status: in_progress$/m, '> status: done');

      // Agregar closed si no existe
      if (!content.includes('> closed:')) {
        content = content.replace(
          /^(> status: done)$/m,
          `$1\n> closed: ${today}`
        );
      }

      fs.writeFileSync(hotfixMd, content, 'utf8');
    }

    // Limpiar .active
    fs.writeFileSync(activeFile, '', 'utf8');

    process.exit(0);
  } catch {
    // Fail-open: nunca bloquear el cierre de sesión
    process.exit(0);
  }
});
