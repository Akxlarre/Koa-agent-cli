/**
 * lib/contracts.js — Los contratos del harness, como DATOS
 *
 * El harness tiene artefactos que una pieza escribe y otra lee. Tres estaban
 * declarados en `templates-contract.md`; el resto vivia solo en la cabeza de quien
 * escribio cada hook. De ahi salieron los 12 ACO de la auditoria y hallazgos como
 * HUE-003 (compact-recovery conocia 10 de los 15 indices) o HUE-005 (blueprint.json
 * decide que guardrails corren y nadie lo valida).
 *
 * Una tabla en un .md no se puede verificar. Este registro si: su test contrasta
 * cada fila contra el filesystem y falla cuando alguien agrega un consumidor sin
 * declararlo, o declara uno que ya no existe.
 *
 * Cada fila lleva los dos campos que los ADR agregaron:
 *   lifetime  cuando se borra     — turno | sesion | permanente   (ADR-002 §1)
 *   scope     quien lo comparte   — sesion | hilo | proyecto      (ADR-003 §1)
 *
 * Ver docs/diseno/ADR-001 §5.
 */

/** Los 15 indices del proyecto. La lista canonica: quien conozca menos, esta incompleto. */
const INDICES = [
  'ANTI-PATTERNS', 'COMPONENTS', 'DATABASE', 'DIRECTIVES', 'FACADES',
  'GUARDS', 'LAYOUTS', 'MODELS', 'PIPES', 'ROUTES',
  'SERVICES', 'STORES', 'STYLES', 'USAGE-MAP', 'UTILS',
];

/**
 * `producers` y `consumers` son rutas relativas a la raiz del proyecto generado.
 * Las que van entre <> son actores, no archivos, y el test las saltea.
 * `format` describe lo que la otra punta necesita para poder leerlo.
 */
const CONTRACTS = {
  'session-writes.json': {
    path: '.claude/temp/session-writes.json',
    format: 'array JSON de rutas relativas, con separadores "/"',
    producers: ['.claude/hooks/write-tracker.js'],
    consumers: [
      '.claude/hooks/sync-check.js',
      '.claude/hooks/spec-diff-check.js',
      '.claude/hooks/spec-reflection.js',
    ],
    lifetime: 'sesion',
    scope: 'sesion',
    nota: 'ACO-001: sync-check lo borraba en cada Stop, dejando sin datos a los otros dos.',
  },

  'discovery-flag': {
    path: '.claude/temp/session/<sid>/discovery.flag',
    format: 'lineas "ISO | ORIGEN | indices/NOMBRE.md" — compact-recovery parsea la ruta',
    producers: ['.claude/hooks/discovery-tracker.js', '.claude/hooks/session-start.js'],
    consumers: ['.claude/hooks/pre-write-guard.js', '.claude/hooks/compact-recovery.js'],
    lifetime: 'sesion',
    scope: 'sesion',
    nota: 'HUE-002: vivia en TMPDIR bajo la clave "default", global a toda la maquina.',
  },

  'spec-reflection-seen.json': {
    path: '.claude/temp/spec-reflection-seen.json',
    format: 'objeto JSON; marca de anti-bucle del hook de Stop',
    producers: ['.claude/hooks/spec-reflection.js'],
    consumers: ['.claude/hooks/spec-reflection.js'],
    lifetime: 'turno',
    scope: 'hilo',
  },

  'breaker.json': {
    path: '.claude/temp/session/<sid>/thread-<tid>/breaker.json',
    format: 'objeto { "<archivo>::<violacion>": intentos }; al 3er intento corta y escala',
    producers: ['.claude/hooks/pre-write-guard.js'],
    consumers: ['.claude/hooks/pre-write-guard.js'],
    lifetime: 'sesion',
    scope: 'hilo',
    nota: 'ACO-007: no estaba declarado. Vivia en TMPDIR bajo la clave global "default" '
        + '(HUE-002), asi que un proyecto cortaba el breaker de otro. Es de HILO (HUE-032): '
        + 'los tres intentos son de quien escribe, no de la sesion entera.',
  },

  'ctx-<categoria>.json': {
    path: '.claude/temp/session/<sid>/thread-<tid>/ctx-<categoria>.json',
    format: 'marca { at: ISO } por categoria de archivo; su presencia significa "ya inyectado"',
    producers: ['.claude/hooks/pre-write-guard.js'],
    consumers: ['.claude/hooks/pre-write-guard.js'],
    lifetime: 'sesion',
    scope: 'hilo',
    nota: 'ACO-007: son 11 categorias (features, shared, layout, repositories, facades, '
        + 'services, utils, directives, migrations, html, scss). Ambito de HILO: describe '
        + 'LO QUE YA SE DIJO, y lo que oyo un subagente no lo oyo el hilo principal.',
  },

  'budget-<clave>.json': {
    path: '.claude/temp/session/<sid>/thread-<tid>/budget-<clave>.json',
    format: '{ n, hash } — hash del ultimo texto emitido; la dedup es por CONTENIDO',
    producers: ['.claude/hooks/lib/budget.js'],
    consumers: ['.claude/hooks/lib/budget.js'],
    lifetime: 'sesion',
    scope: 'hilo',
    nota: 'Lo escribe budget.js por cuenta de quien lo llama: prompt-context —de donde '
        + 'salio el patron, y donde vivia como koa-prompt-ctx-*.json (ACO-006)—, '
        + 'plan-injector (CAR-001), compact-recovery (CAR-004) y context-guardian '
        + '(CAR-002). Que la dedup sea por '
        + 'contenido es lo que hace que un aviso vuelva solo cuando cambia lo que dice, '
        + 'sin ninguna caducidad. compact-recovery lo borra con olvidar(): tras compactar, '
        + '"ya lo dije" sigue siendo cierto pero "y vos lo tenes" ya no.',
  },

  'task-spec': {
    path: '.claude/temp/task-spec-YYYYMMDD-HHMMSS.md',
    format: 'encabezados ## exactos + casillas "- [ ]" / "- [x]"; el nombre ordena por fecha',
    producers: ['.claude/skills/plan/SKILL.md'],
    consumers: [
      '.claude/hooks/spec-reflection.js',
      '.claude/hooks/prompt-context.js',
      '.claude/hooks/compact-recovery.js',
      '.claude/hooks/session-start.js',
      '.claude/hooks/validators/validate-file-contains.js',
    ],
    lifetime: 'permanente',
    scope: 'proyecto',
    nota: 'El contrato con mas consumidores. Era el unico de los cinco sin test (HUE-006): '
        + 'los cinco consumidores tenian el suyo, y lo que NO tenia ninguno era lo que los '
        + 'ata — los encabezados, el orden del nombre y las casillas. Eso prueba '
        + '.claude/tests/task-spec.test.js, corriendo los consumidores de verdad.',
  },

  'blueprint.json': {
    path: 'blueprint.json',
    format: 'objeto JSON con `stack` como objeto de banderas booleanas',
    producers: ['<el CLI, al generar>'],
    consumers: ['.claude/hooks/pre-write-guard.js', 'scripts/architect.js'],
    lifetime: 'permanente',
    scope: 'proyecto',
    nota: 'HUE-005 (S1): su `stack` crudo decide que guardrails corren y nadie lo valida.',
  },

  'LESSONS_LEARNED.md': {
    path: '.claude/temp/LESSONS_LEARNED.md',
    format: 'tabla markdown entre marcadores AUTO-GENERATED; fuera de ellos, prosa libre. '
        + 'El separador "|" va escapado — lo hace lib/lessons.js, que es quien conoce el formato',
    producers: ['.claude/hooks/failure-tracker.js', 'scripts/lint-arch-wrapper.js'],
    consumers: ['.claude/hooks/pre-write-guard.js', '.claude/hooks/lib/lessons.js'],
    lifetime: 'permanente',
    scope: 'proyecto',
    nota: 'DUP-002 y HUE-016, cerrados. Eran: dos productores donde uno reescribia el '
        + 'archivo entero y borraba las secciones del otro; y un "|" sin escapar que '
        + 'partia la fila y devolvia la firma truncada, rompiendo el dedup para siempre.',
  },

  'indices-cache.json': {
    path: '.claude/temp/indices-cache.json',
    format: 'objeto JSON de mtimes; decide que se re-parsea',
    producers: ['scripts/indices-sync.js'],
    consumers: ['scripts/indices-sync.js'],
    lifetime: 'sesion',
    scope: 'proyecto',
    nota: 'ACO-003. La ruta estaba MAL declarada —decia scripts/— y nada lo verificaba: '
        + 'el test miraba que las PIEZAS existieran, no que el `path` fuera real. Vive bajo '
        + '.claude/temp/, que va gitignored y se limpia; por eso su lifetime es de sesion '
        + 'aunque el artefacto sobreviva a la corrida: perderlo solo cuesta un re-parseo.',
  },

  'specs/.active': {
    path: 'specs/.active',
    format: 'una linea con el id del track activo, o vacio',
    producers: ['.claude/commands/spec-activate.md', '.claude/commands/hotfix.md'],
    consumers: [
      '.claude/hooks/sdd/spec-gate.js',
      '.claude/hooks/sdd/plan-injector.js',
      '.claude/hooks/sdd/hotfix-autoclose.js',
    ],
    lifetime: 'permanente',
    scope: 'proyecto',
  },

  'review-diff.patch': {
    path: '.claude/temp/review-diff.patch',
    format: 'diff unificado; canal entre /review y el subagente code-judge',
    producers: ['.claude/skills/review/SKILL.md'],
    consumers: ['.claude/agents/code-judge.md'],
    lifetime: 'turno',
    scope: 'sesion',
    nota: 'ACO-011: no estaba declarado en ningun lado.',
  },

  'DETAIL:BEGIN': {
    path: 'indices/*.md',
    format: 'marcador HTML que separa Quick Reference de los ejemplos',
    producers: ['.claude/agents/index-syncer.md'],
    consumers: [
      '.claude/hooks/session-start.js',
      '.claude/hooks/compact-recovery.js',
      '.claude/hooks/lib/budget.js',
    ],
    lifetime: 'permanente',
    scope: 'proyecto',
    nota: 'ACO-005: contrato de 3 piezas sin declarar.',
  },

  'last_updated:': {
    path: 'context/brief.md',
    format: '**last_updated:** YYYY-MM-DD — la frescura se audita al abrir la sesion',
    producers: ['<el humano>'],
    consumers: ['.claude/hooks/session-start.js', '.claude/hooks/discovery-tracker.js'],
    lifetime: 'permanente',
    scope: 'proyecto',
    nota: 'ACO-005.',
  },

  'provocacion.baseline.json': {
    path: 'scripts/provocacion.baseline.json',
    format: '{ sinFixture: string[] } — solo puede achicarse',
    producers: ['scripts/provocar-reglas.mjs'],
    consumers: ['scripts/provocar-reglas.mjs'],
    lifetime: 'permanente',
    scope: 'proyecto',
    nota: 'ACO-009: la provocacion depende de que architect.js nombre el codigo de la regla. '
        + 'Hoy esta VACIO: las 28 reglas tienen fixture (DEC-004, HUE-019).',
  },

  'AUTO-GENERATED:BEGIN': {
    path: 'indices/*.md, specs/ASSIGNMENTS.md, .claude/temp/LESSONS_LEARNED.md',
    format: 'par de marcadores HTML; adentro se reescribe entero, afuera no se toca nunca',
    producers: [
      'scripts/indices-sync.js',
      'scripts/assignments-sync.js',
      '.claude/hooks/lib/lessons.js',
    ],
    consumers: [
      'scripts/indices-sync.js',
      'scripts/assignments-sync.js',
      '.claude/hooks/lib/lessons.js',
      '.claude/agents/index-syncer.md',
      '.claude/hooks/harness-gate.js',
    ],
    lifetime: 'permanente',
    scope: 'proyecto',
    nota: 'ACO-013: es el patron mas reusado del blueprint —tres productores— y no estaba '
        + 'declarado en ningun lado. INC-022: assignments-sync se niega a escribir sin '
        + 'marcadores, y la plantilla canonica no los traia. HUE-007, cerrado: nada impedia '
        + 'editar ADENTRO, y el trabajo no fallaba —desaparecia en la proxima corrida del '
        + 'generador, sin rastro—. Lo frena GATE-D1 en harness-gate, que detecta la superficie '
        + 'por los marcadores EN DISCO y no por una lista de rutas, que es lo que se '
        + 'desactualiza (HUE-003).',
  },

  'author.local.json': {
    path: '.claude/author.local.json',
    format: '{ "code": "X" } — una letra; gitignored, es identidad local, no del repo',
    producers: ['<el humano, copiando author.local.json.example>'],
    consumers: [
      '.claude/commands/assign-new.md',
      '.claude/commands/assign-list.md',
      '.claude/commands/assign-claim.md',
    ],
    lifetime: 'permanente',
    scope: 'proyecto',
    nota: 'ACO-013. Va gitignored A PROPOSITO: si viajara en el repo, dos personas '
        + 'clonarian el mismo codigo de autor y los track IDs colisionarian.',
  },

  'arch-last-failure.json': {
    path: '.claude/temp/arch-last-failure.json',
    format: 'la ultima corrida fallida de lint:arch, para que el subagente no la repita',
    producers: ['scripts/lint-arch-wrapper.js'],
    consumers: ['.claude/agents/arch-auditor.md'],
    lifetime: 'sesion',
    scope: 'proyecto',
    nota: 'ACO-013: el canal entre un script y un subagente. El unico contrato del harness '
        + 'cuyo consumidor es un .md que describe a un agente, no codigo que lo lea.',
  },

  'class-discipline.baseline.json': {
    path: 'scripts/class-discipline.baseline.json',
    format: 'conteos por regla del DS; ratchet — un conteo solo puede bajar',
    producers: ['scripts/architect.js'],
    consumers: ['scripts/architect.js', 'scripts/lib/class-discipline.js'],
    lifetime: 'permanente',
    scope: 'proyecto',
    nota: 'ACO-013. Koa se entrega SIN este archivo: tolerancia cero. Se genera con '
        + '`npm run lint:arch -- --update-ds-baseline` solo si el proyecto adopta deuda '
        + 'a proposito, y entonces el ratchet la congela en vez de dejarla crecer.',
  },

  'contrast.baseline.json': {
    path: 'scripts/contrast.baseline.json',
    format: 'pares token/fondo que hoy no llegan a AA; ratchet propio de ARCH-25',
    producers: ['scripts/architect.js'],
    consumers: ['scripts/architect.js'],
    lifetime: 'permanente',
    scope: 'proyecto',
    nota: 'ACO-013. Tambien ausente de fabrica, y por el mismo motivo.',
  },

  'bento-classes.allowlist.json': {
    path: 'scripts/lib/bento-classes.allowlist.json',
    format: '{ classes: string[] } — toda clase .bento-* del SCSS tiene que estar aca',
    producers: ['<el humano, al aprobar una clase nueva>'],
    consumers: ['scripts/architect.js', 'scripts/check-bento-classes.js'],
    lifetime: 'permanente',
    scope: 'proyecto',
    nota: 'ACO-013 y ARCH-21: el freno contra el sprawl del bento. A diferencia de los dos '
        + 'baselines, este SI viaja en el payload — no es deuda tolerada, es el vocabulario '
        + 'aprobado.',
  },
};

/**
 * Los consumidores que MANTIENEN A MANO la lista de indices (HUE-003, HUE-030).
 *
 * Eran dos, y omitian exactamente los mismos cinco —GUARDS, LAYOUTS, ROUTES,
 * USAGE-MAP, UTILS—: se agregaron despues y ninguno de los dos se entero.
 *
 * `compact-recovery.js` salio de esta lista porque dejo de tener lista: lee
 * `indices/` del disco. Queda `AGENTS.md`, que es prosa para otras AI tools y
 * no puede derivar nada — por eso su test compara contra el filesystem.
 */
const CONSUMIDORES_DE_INDICES = ['AGENTS.md'];

/** Todo artefacto declarado, como lista. */
function all() {
  return Object.entries(CONTRACTS).map(([id, c]) => ({ id, ...c }));
}

/** Quien lee esto. */
function consumersOf(id) {
  return CONTRACTS[id] ? CONTRACTS[id].consumers : [];
}

/** Quien lo escribe. */
function producersOf(id) {
  return CONTRACTS[id] ? CONTRACTS[id].producers : [];
}

/** Las rutas de piezas reales; los actores entre <> no son archivos. */
function piezasDe(entry) {
  return [...(entry.producers || []), ...(entry.consumers || [])]
    .filter((p) => !p.startsWith('<'));
}

module.exports = {
  CONTRACTS,
  INDICES,
  CONSUMIDORES_DE_INDICES,
  all,
  consumersOf,
  producersOf,
  piezasDe,
};
