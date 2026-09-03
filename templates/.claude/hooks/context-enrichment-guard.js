#!/usr/bin/env node
/**
 * context-enrichment-guard.js — PreToolUse Hook (Edit|Write|MultiEdit)
 *
 * Fase 0: Day 0 Context Seeding Guard
 *
 * Este guardrail evita el problema del "lienzo en blanco" (vacío de conocimiento de negocio).
 * Si `context/domain.md` o `indices/DATABASE.md` están vacíos o siguen siendo el template
 * sin rellenar, bloquea la escritura de código fuente y obliga a pedirle contexto al humano.
 *
 * ⚠️ OPT-IN — NO viene cableado en `.claude/settings.json` por defecto.
 *
 * Motivo: un proyecto recién generado por Koa trae `context/domain.md` e `indices/*.md` como
 * plantillas vacías por diseño. Wireado por defecto, este hook bloquearía TODA escritura de
 * código desde el minuto cero, antes de que el usuario alcance a llenar nada.
 *
 * DEC-008 — ese motivo era FALSO hasta ahora, y por eso la decisión de dejarlo
 * apagado se tomó para evitar un comportamiento que el hook no tenía. Su detector
 * buscaba tres marcadores, y el único que las plantillas traían de verdad
 * —`{{PROJECT_NAME}}`— lo reemplaza `injectVars` al generar; el umbral de 50
 * chars lo pasaba cualquier plantilla con su propio andamiaje markdown. En un
 * proyecto recién generado —el escenario exacto para el que se escribió— no
 * bloqueaba nada.
 *
 * Ahora la detección es `budget.sinLlenar`, y el motivo de arriba es cierto: si
 * se cablea, bloquea desde el minuto cero. Sigue siendo opt-in, pero ahora es
 * una decisión sobre un comportamiento real.
 *
 * Actívalo cuando quieras esa disciplina (recomendado en proyectos con dominio complejo),
 * agregando a `.claude/settings.json` bajo PreToolUse / matcher "Edit|Write|MultiEdit":
 *
 *   { "type": "command", "command": "node .claude/hooks/context-enrichment-guard.js" }
 */

const fs = require('fs');
const path = require('path');
const payload = require('./lib/payload.js');
const paths = require('./lib/paths.js');
const budget = require('./lib/budget.js');

payload.read().then((PAYLOAD) => {
  try {
    const filePath = PAYLOAD.filePath;

    // La misma pregunta que hace el Discovery Gate, con el mismo nombre: si esto
    // exige haber descubierto, exige también tener un dominio escrito.
    if (paths.needsDiscovery(filePath, PAYLOAD.cwd)) {
      // Ubicaciones del contexto crítico, según la convención Koa:
      //   context/domain.md   → Lenguaje Ubicuo / entidades del negocio
      //   indices/DATABASE.md → modelo de datos emparejado
      const workspaceRoot = PAYLOAD.cwd;
      const SURFACES = [
        { path: path.join(workspaceRoot, 'context', 'domain.md'), label: 'context/domain.md (Lenguaje Ubicuo)' },
        { path: path.join(workspaceRoot, 'indices', 'DATABASE.md'), label: 'indices/DATABASE.md (modelo de datos)' },
      ];

      // DEC-008 / DEC-006 — el detector no disparaba en un proyecto recién
      // generado, que es EXACTAMENTE el caso para el que este hook existe.
      //
      // Buscaba tres marcadores y `{{PROJECT_NAME}}` era el único que las
      // plantillas traen de verdad — y `injectVars` lo reemplaza al generar, así
      // que el marcador no llega vivo a ningún proyecto. Y el umbral de 50 chars
      // medía el archivo entero: el andamiaje markdown de las plantillas
      // (encabezados, blockquotes de instrucciones, tablas vacías) ya pasa de 50
      // sin una sola palabra escrita por una persona.
      //
      // `budget.isPlaceholder` mide CONTENIDO REAL: quita comentarios HTML,
      // encabezados, blockquotes y bullets vacíos. Medido sobre templates/: las
      // cuatro plantillas de context/ caen a 0-66 chars.
      const missingFiles = [];

      for (const surface of SURFACES) {
        if (!fs.existsSync(surface.path)) {
          missingFiles.push(`${surface.label} — falta el archivo`);
          continue;
        }
        const content = fs.readFileSync(surface.path, 'utf8');
        if (budget.sinLlenar(content)) {
          missingFiles.push(`${surface.label} — sigue siendo la plantilla sin rellenar`);
        }
      }

      if (missingFiles.length > 0) {
        process.stderr.write(
          `\u{1F6A7} DAY 0 CONTEXT GUARD: Prohibido programar a ciegas en un dominio nuevo.\n\n` +
          `Este proyecto carece de Contexto de Negocio fundacional.\n` +
          `Faltan o estan incompletas estas superficies:\n` +
          missingFiles.map(f => `  - ${f}`).join('\n') + `\n\n` +
          `INSTRUCCION PARA TI (AGENTE):\n` +
          `Dile al usuario: "Alto. Este proyecto todavia no tiene contexto de negocio. Pasame un brief, ` +
          `o detallame el Lenguaje Ubicuo (vocabulario del dominio) y el modelo preliminar de datos, ` +
          `para nutrir context/domain.md e indices/DATABASE.md ANTES de que yo escriba interfaces o ` +
          `facades a ciegas."\n\n` +
          `No escribas codigo fuente hasta rellenar esa base de conocimiento.`
        );
        process.exit(2);
      }
    }

    process.exit(0);
  } catch (e) {
    // Fail-open: si falla el script de validación, permitir
    process.exit(0);
  }
});
