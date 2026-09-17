<div align="center">

# create-koa-agent

**Scaffold Angular projects with an agentic harness that enforces its own rules.**

[![CI](https://github.com/Akxlarre/Koa-agent-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/Akxlarre/Koa-agent-cli/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/create-koa-agent?style=flat-square)](https://www.npmjs.com/package/create-koa-agent)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen?style=flat-square&logo=nodedotjs)](https://nodejs.org)
[![Angular](https://img.shields.io/badge/Angular-v20%2B-dd0031?style=flat-square&logo=angular)](https://angular.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](./LICENSE)

</div>

```bash
npx create-koa-agent my-app
cd my-app
ng serve
```

Most AI coding tools are bolted onto codebases that weren't built for them. The agent reads
a `rules.md`, promises to behave, and drifts anyway — because nothing *enforces* the rules,
and nothing keeps its knowledge of the codebase alive.

This takes the opposite approach. The CLI is one night's work; **what it installs is the
product**. Every generated project ships with a full agentic harness:

- **Guardrails, not guidelines.** Hooks intercept every agent action in real time. The agent
  *cannot* write code before reading the project indexes, *cannot* violate the architecture,
  *cannot* commit unregistered components. It gets blocked, told which rule and why, and
  pointed at the fix.
- **Living memory.** The indexes (components, facades, database schema, anti-patterns) are
  maintained by the agent itself — enforced by hooks and refreshed by an AST auto-indexer.
- **Judged, not just linted.** What no regex catches — a facade that doesn't honor its
  contract, an RLS policy anyone can bypass — goes to two subagent judges, and the judges
  themselves are measured against fixtures with ground truth.
- **A versioned blueprint.** Every project carries a `blueprint.json` with its harness
  version and managed paths, so the harness keeps improving after day one instead of rotting
  like a cloned starter.
- **Checks that are themselves checked.** Every rule in the box has been put in front of its
  own violation. A check that can't fail is worse than no check at all.

## Extracted, not invented

This harness was not designed on a whiteboard. It was **extracted from a production Angular +
Supabase platform** built almost entirely by AI agents, where every rule exists because its
absence caused a real bug, a real regression, or a real week of cleanup. The hooks, the
anti-pattern catalog, the index discipline — battle-tested in production first, then distilled
into this CLI. It now powers multiple projects from the same blueprint.

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [What you get](#what-you-get)
- [The agentic harness](#the-agentic-harness)
- [Two judges](#two-judges)
- [The checks that check themselves](#the-checks-that-check-themselves)
- [Versioned blueprint](#versioned-blueprint)
- [Feature generator](#feature-generator)
- [Stack](#stack)
- [Agent workflow](#agent-workflow)
- [Beyond Claude Code](#beyond-claude-code)
- [How it compares](#how-it-compares)
- [Honest limits](#honest-limits)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

## Install

Requires **Node ≥ 20**. Nothing to install globally:

```bash
npx create-koa-agent my-app
```

The CLI checks your environment first (Node, npm, git), then asks two questions: **Full
Scaffold** or **Inject Only**, and which AI tools you use (Claude Code, Cursor, Windsurf,
Copilot).

## Usage

### Full Scaffold — a new project

`ng new` + dependencies + boilerplate + the complete harness. It runs in a temp directory
with automatic rollback, so a failed run never leaves you with half a project.

```bash
npx create-koa-agent my-app
# → choose "Full Scaffold"
```

### Inject Only — an existing project

Drops the harness (`.claude/`, `indices/`, `context/`, `docs/`, `scripts/`) into a project
you already have. **It respects what you wrote**: your code, your `context/` and your
`indices/` are preserved; only harness-owned paths are overwritten.

```bash
cd my-existing-angular-app
npx create-koa-agent
# → choose "Inject Only"
```

This is also how you upgrade between blueprint versions.

## What you get

```
my-app/
├── src/app/
│   ├── core/              # Facades, repositories, guards, services, models
│   ├── features/          # Smart Components (routable pages)
│   ├── shared/            # Dumb Components (presentational UI)
│   └── layout/            # Shell, Sidebar, Topbar
│
├── .claude/               # The agentic harness — the actual product
│   ├── CLAUDE.md          # Agent directive: stack, rules, workflow
│   ├── hooks/             # Real-time guardrails — 18 across 9 events
│   │   └── validators/    # Generic, flag-driven structure validators
│   ├── agents/            # 6 subagents with their own context windows
│   ├── rules/             # 16 path-scoped rules — 8 mechanized, 8 social
│   ├── skills/            # 16 agent skills (/plan, /review, …)
│   ├── evals/             # Fixtures with ground truth, to measure the judges
│   └── tests/             # Unit tests for the hooks themselves
│
├── context/               # Semantic seed: brief, domain glossary, constraints,
│                          # decision log
├── indices/               # 15 living indexes — the agent's memory
│   ├── COMPONENTS.md      # Every component in the project
│   ├── FACADES.md         # Every facade + its exposed signals
│   ├── DATABASE.md        # Tables, FKs, RLS policies
│   ├── ANTI-PATTERNS.md   # Documented mistakes the agent must not repeat
│   └── …                  # SERVICES, MODELS, STYLES, LAYOUTS, DIRECTIVES,
│                          # PIPES, STORES
│
├── scripts/
│   ├── architect.js       # AST-based architecture linter
│   └── indices-sync.js    # Incremental AST auto-indexer
│
├── supabase/              # Migrations + local config
├── docs/                  # Stack rules, brand guidelines, harness contracts
├── .mcp.json              # MCP server manifest (Supabase, etc.)
├── AGENTS.md              # Portable rules for Cursor / Copilot / Windsurf
└── blueprint.json         # Harness version + managed paths (upgrade contract)
```

## The agentic harness

This is the part that matters. `.claude/` is not documentation — it's infrastructure that
runs.

### Hooks — 18 wired across 9 events

| Hook | Trigger | What it does |
|---|---|---|
| `session-start` | On session open | Injects core indexes, the brief's objective and any unfinished task-spec — so the agent never starts blind |
| `prompt-context` | Before each prompt | Re-surfaces what's out of scope this session and what's still open on the spec |
| `spec-gate` | Before any write | With a `specs/` folder present, blocks code that has no active spec and plan behind it |
| `pre-write-guard` | Before any write | Four layers: File Protection → Discovery Gate → Architect Guard → Context Injection |
| `harness-gate` | Before any write | Guards the harness itself: a "lesson" with no applicability criterion is a recipe, not a rule |
| `plan-injector` | Before any write | Injects the live spec, plan and open tasks as context |
| `bash-guard` | Before Bash | Blocks source-file creation via shell (forces Edit/Write so the guards can run), plus the Approval Gate |
| `spec-diff-check` | Before `git commit` | Blocks the commit if new components or facades aren't registered in the indexes |
| `discovery-tracker` | After any file read | Tracks when indexes are read; unlocks the Discovery Gate |
| `write-tracker` | After writes | Records modified files for the Sync Check |
| `post-edit` | After writes | Runs Prettier automatically |
| `failure-tracker` | On tool failure | Logs errors to `LESSONS_LEARNED.md` with dedup and rotation |
| `compact-recovery` | On context compaction | Re-injects the indexes the agent had already read, so it doesn't lose memory mid-session |
| `subagent-cleanup` | On subagent stop | Clears the temp files a subagent leaves behind |
| `hotfix-autoclose` | On session end | Safety net: closes a hotfix left open |
| `spec-reflection` | On agent stop | Returns the task-spec's done criteria that are still open |
| `sync-check` | On agent stop | Compares file timestamps vs. indexes; reminds the agent to update its memory |
| `context-guardian` | On agent stop | "Did you learn anything today?" when `learnings.md` has been still for over 14 days |

Every hook ships with its own contract tests (`npm run claude:test-hooks`). The harness is
code, and it's tested like code — `compact-recovery.js` sat broken for entire versions,
failing silently on every compaction, precisely because no test ever ran it.

### The four layers of `pre-write-guard`

| Layer | What it does |
|---|---|
| **File Protection** | Blocks editing `.claude/hooks/`, `settings.json`, `architect.js` — the agent cannot dismantle its own brakes |
| **Discovery Gate** | Without the index flag in context, nothing gets written to `src/app/` |
| **Architect Guard** | Real-time validation of the new content: `*ngIf`, `@Input()`, hardcoded Tailwind colors, Supabase imported in UI, missing RLS (`SEC-RLS-01/02/03`), a11y (`A11Y-03`) |
| **Context Injection** | Injects the context relevant to the file type, deduplicated once per category per session |

Two mechanisms only fire when the agent is heading somewhere it shouldn't:

- **Circuit Breaker** (inside `pre-write-guard`) — a plain `exit 2` is a "no" with no memory,
  so a blocked agent can retry the same write forever. After three identical blocks the guard
  stops explaining the fix and orders an escalation to a human, closing the escape hatches by
  name (shell, renaming, splitting the change).
- **Approval Gate** (inside `bash-guard`) — `supabase db push`, `db reset`, `migration repair`,
  `link` and destructive `psql` need a person. Writing the migration is the agent's job;
  applying it against a real database is not.

### Discovery Gate in action

The agent **cannot write code** without first reading the project indexes. If it tries, it
gets blocked:

```
🔍 DISCOVERY GATE: You must read the project indexes before writing source code.
Read at least one of these first:
  - indices/COMPONENTS.md
  - indices/SERVICES.md
  - indices/FACADES.md
  ...
The block lifts automatically once you read any file in indices/.
```

### Architect Guard

Every write is validated in real time against the project's architecture. The guard blocks
patterns like:

- `*ngIf` / `*ngFor` (use `@if` / `@for`)
- `@Input()` / `@Output()` decorators (use signal-based `input()` / `output()`)
- Hardcoded Tailwind colors (`text-red-500`) — enforces design tokens
- Importing Supabase directly in UI components (use a Facade)
- Components without `OnPush` change detection
- SQL migrations without Row Level Security

Everything the guard enforces in real time is also available as a full audit:
`npm run lint:arch` walks the AST of the whole project and reports violations with `[ARCH-NN]` codes
and doc links.

### Proactive context, not just reactive blocking

A guardrail that fires *after* the agent decided what to do is a guardrail that costs a round
trip. Two hooks run before the agent can go wrong:

- **`session-start`** injects the core indexes, the session objective from `context/brief.md`
  and any unfinished task-spec — then writes the discovery flag itself. If the agent already
  has the indexes in context, blocking it for "not reading the indexes" would be a lie. The
  Discovery Gate stays as the safety net for when this injection doesn't happen.
- **`prompt-context`** runs before *every* prompt, so it deliberately carries almost nothing:
  only what decays inside a single session — the brief's **out of scope** list (the first
  constraint an agent forgets, because nothing in the conversation repeats it) and the spec's
  open checkboxes. Deduplicated: a block re-appears only if it changed, or every 8 prompts. A
  reminder shown every turn stops being read.

### Structure validated, not requested

`/plan` declares its own Stop hook in frontmatter:

```yaml
hooks:
  Stop:
    - hooks:
        - type: command
          command: >-
            node $CLAUDE_PROJECT_DIR/.claude/hooks/validators/validate-file-contains.js
            --directory .claude/temp --pattern "task-spec-*.md" --require-file
            --contains "## Objetivo" --contains "## Criterio de done"
```

Asking an agent in prose to "produce a file with these sections" is a guideline, and
guidelines get dropped under context pressure. This makes it a guardrail. The validator itself
knows nothing about the project — it takes what to look for as flags, so one validator covers
every artifact whose *structure* matters.

### The harness watches the harness

`harness-gate` applies to the files that shape the agent's behavior — `rules/`, learnings,
`ANTI-PATTERNS.md`, `CLAUDE.md`. Two families:

- **Generalization Gate** — a "lesson" citing `fix-042` with no applicability criterion is a
  recipe, not a rule. Keyword-matching dispatch snippets get blocked too.
- **Placement** — deterministic logic lives in code (scripts, hooks), never as prose dressed
  up as a mechanism, nor the reverse: advice with no mechanism smuggled into a script.

### Living indexes

The indexes in `indices/` are the agent's long-term memory: what exists, where it lives, and
which mistakes were already made once. Two mechanisms keep them honest:

- **Enforcement** — `spec-diff-check` refuses to commit unregistered components and facades,
  and `sync-check` flags stale indexes at the end of every session.
- **Automation** — `npm run indices:sync` regenerates the AST-derived sections (incremental,
  cached by mtime), so the baseline never depends on agent goodwill.

### Subagents — what the guard can't see

The guard catches **syntax**: `*ngIf`, `@Input()`, hardcoded colors, a missing `OnPush`. All
of that is regex and AST, and it catches itself.

What no hook catches is **design** — a facade that doesn't honor its contract, a repository
skipped, a Smart component wearing a Dumb component's clothes, a name that contradicts the
project's own domain glossary. Those pass every guardrail clean.

That's what `.claude/agents/` is for. Each subagent runs in its own context window and returns
a summary instead of dumping files into the main conversation:

| Subagent | Returns | Model |
|---|---|---|
| `discovery-scout` | What to reuse / what to create / what to avoid | fast |
| `arch-auditor` | `lint:arch` + `tsc` compressed to actionable violations | fast |
| `index-syncer` | Reconciles `indices/*.md` against the real code | fast |
| `supabase-schema` | Real tables, FKs and RLS policies from the migrations | fast |
| `code-judge` | Per-criterion verdict against the project's rubric | reasoning |
| `security-judge` | Privilege escalation, bypassable RLS, data leakage — the failure that passes the deterministic checks | reasoning |

## Two judges

Some failures no regex catches. `/review` triggers on **risk**, not on file count:

| Risk | What defines it | Judges |
|---|---|---|
| 🟢 Low | Styles, docs, comments, tests | None — commit |
| 🟡 Medium | Component logic, facades, repositories, services | `code-judge` |
| 🔴 High | `supabase/migrations/`, auth, guards, RPC, Storage | `code-judge` **+** `security-judge`, in parallel |

At 🔴 the **worst verdict wins**: a security `RECHAZADO` is not offset by an architectural
`APROBADO`. Well-layered code doesn't make an open policy safe. One line in an RLS policy is
more dangerous than five SCSS files, so a 🔴 diff runs both judges even if it touches a single
file.

`code-judge` runs against a fixed rubric — the `ARCH-*` codes, the path-scoped rules and
`indices/ANTI-PATTERNS.md` — on a stronger model than the one writing the code, on purpose: an
evaluator that reasons like the generator shares the generator's blind spots. A `RECHAZADO`
must name a file and a concrete fix, or it gets demoted to a minor finding. Opinions don't
block commits.

Neither judge has `Write`, `Edit` or `Bash` — they receive the diff as a file. With `Bash`
they could write using `>`, and "the judge fixes nothing" would be a promise instead of a
fact. A judge that can edit the code it judges is not a judge.

**And the judges are measured.** `.claude/evals/` ships 7 fixtures with ground truth in their
frontmatter — 4 vulnerable, 3 clean controls — and `/eval-jueces` reports recall, false
positives and per-criterion precision. Run it after editing a judge's prompt, before trusting
its verdict. You can't verify the quality of a summary; you *can* verify whether the judge
detects what its rubric promises.

## The checks that check themselves

A check that exits 0 without looking at anything is **worse than not having it**. The missing
one gets noticed; the decorative one gives you the feeling of being protected, and that feeling
is why nobody looks again.

Two commands ask the question no CI asks — not *do the checks pass*, but *can they fail*:

```bash
npm run lint:arch:provocar   # builds a sandbox per rule containing the minimal file
                             # that violates it, and demands the linter name it. 28/28.
npm run smoke:scripts        # injects a real defect and demands each package.json
                             # script notice. Restores it in a `finally`, always.
```

They exist because of three bugs that lived for months in the codebase this harness came from:
a `tsc --noEmit -p tsconfig.json` that compiled **zero files** and exited 0 (the Angular CLI's
root tsconfig is solution-style); a `node --test` pointed at Deno tests, which failed every run
and read like "there are broken tests"; and an architecture rule that was written, unit-tested,
and **never wired to a caller** — it audited exactly nothing.

Each rule also declares in its frontmatter whether a mechanism backs it:

| `enforcement:` | What it means |
|---|---|
| `mecanizada` | A hook or the linter blocks it. The frontmatter names the codes (`ARCH-01`, `A11Y-03`…), so an agent blocked by `[ARCH-12]` can reach the rule that explains it |
| `social` | **Nothing enforces it.** It's a project agreement — break it and no guardrail says a word |

It's **8 and 8**, and a test derives the truth from which codes each mechanism actually emits,
so the label can't lie. Believing something stops you when nothing does costs as much as being
blocked by `[ARCH-12]` and having no way to reach the rule that explains it.
→ [Why this matters](./templates/docs/CHEQUEOS-QUE-NO-CHEQUEAN.md)

## Versioned blueprint

Starter templates abandon you the day you clone them. Koa projects don't: every scaffold
writes a `blueprint.json` recording the blueprint **version**, the chosen **stack**, and the
**managed paths** — the parts owned by the harness, as opposed to your application code:

```json
{
  "blueprintVersion": "7.2.0",
  "scaffoldMode": "full",
  "stack": { "supabase": true, "primeng": true, "gsap": false },
  "managedPaths": [".claude/", "docs/", "scripts/"]
}
```

That contract is what makes upgrades tractable: re-running the CLI in Inject Only mode updates
the managed paths and leaves everything else alone, and the managed-path boundary tells you
exactly what is safe to replace. Breaking changes are documented per version in the
[CHANGELOG](./CHANGELOG.md).

## Feature generator

Beyond the initial scaffold, the CLI generates full vertical slices inside any Koa project (it
checks for `blueprint.json` first):

```bash
npx create-koa-agent generate feature products
```

Pick the page type — **list** (bento grid + card/skeleton), **detail** (2/3 + 1/3), or **form**
(narrow page) — and it writes the whole slice following the architecture: routable page,
repository, facade with optimistic updates, and colocated Vitest specs. It never overwrites a
file that already exists.

## Stack

| Technology | Purpose |
|---|---|
| Angular (latest stable, standalone) | Framework |
| Tailwind CSS v4 | Utilities on top of semantic design tokens |
| PrimeNG | UI component library |
| Supabase | Backend (auth, DB, storage) + local dev via CLI |
| Vitest | Unit testing (replaces Karma) |
| Lucide Angular | Icons |

```bash
--with-gsap           # GSAP animations
--with-ngrx-signals   # NgRx Signal Store
--with-e2e            # Playwright E2E
--no-supabase         # Skip Supabase
--no-primeng          # Skip PrimeNG
```

Or use a `koa-config.json` in your working directory for persistent defaults:

```json
{ "stack": { "gsap": true, "e2e": false, "supabase": true } }
```

## Agent workflow

Open Claude Code in the generated project and run:

```
Apply the conventions in CLAUDE.md and prepare the environment.
```

The agent reads the indexes and the `context/` brief, understands the architecture, and is
ready to build. The built-in npm scripts keep the loop tight:

```bash
npm run lint:arch           # Full AST architecture audit
npm run indices:sync        # Regenerate indexes from source
npm run claude:review       # Headless architecture review of the session
npm run claude:sync         # Ask the agent to sync the living indexes
npm run claude:fix          # Run ng lint, auto-fix errors
npm run claude:tdd          # Run tests, auto-fix failures until green
npm run claude:test-hooks   # Unit-test the harness hooks themselves
npm run lint:arch:provocar  # Does every rule FIRE against its own violation?
npm run smoke:scripts       # Can every package.json script actually fail?
npm run contracts:doc       # Regenerate docs/CONTRATOS.md from the registry
npm run supabase:start      # Local Supabase (plus stop / reset / diff / types)
```

## Beyond Claude Code

Claude Code gets the full harness. For other tools the CLI generates adapters that carry the
same rules as prose — `AGENTS.md` and `.github/copilot-instructions.md` always, plus
`.cursor/rules/` and `.windsurf/rules/` on request.

Each adapter says so on its first line. Those editors don't run hooks, so **there the rules are
prose, not guardrails**, and the file tells you to run `npm run lint:arch` to verify for real.
A file that reads as if it enforced something it can't is worse than no file.

## How it compares

| | Plain `ng new` | Starter template | Rules file | **create-koa-agent** |
|---|---|---|---|---|
| Architecture conventions | — | Implicit in code | Written down | Written down **and enforced** |
| Agent memory of the codebase | — | — | — | Living indexes + AST auto-indexer |
| Rule violations | — | Silent drift | Agent may ignore | **Blocked in real time** |
| Design failures no linter sees | — | — | — | Two judges, worst verdict wins |
| Lessons from failures | — | — | — | `LESSONS_LEARNED.md` + `ANTI-PATTERNS.md` |
| Evolves after day one | — | No (clone & forget) | Manual copy-paste | Versioned blueprint |
| The checks are themselves checked | — | — | — | Every rule provoked against its own violation |

## Honest limits

- **Angular only**, by design — the harness enforces Angular-specific patterns (signals,
  `@if`/`@for`, standalone components).
- **Claude Code gets enforcement.** Cursor, Windsurf and Copilot share the rules but not the
  hooks. The adapters say so.
- **Supabase is the assumed backend** for the data-layer rules. `--no-supabase` skips it and
  thins the harness.
- **Upgrades are documented, not automated.** Inject Only updates the managed paths;
  behavioral migrations follow the CHANGELOG by hand. An `update` command over `managedPaths`
  is the natural next step.

## Documentation

Generated projects carry their own docs. In this repository:

| Document | What's in it |
|---|---|
| [MAPA-FUNCIONALIDADES.md](./docs/MAPA-FUNCIONALIDADES.md) | The whole system: the generator, the six harness layers, every hook and rule |
| [CHEQUEOS-QUE-NO-CHEQUEAN.md](./templates/docs/CHEQUEOS-QUE-NO-CHEQUEAN.md) | Why the checks are provoked, and the three bugs that motivated it |
| [CONTRATOS.md](./templates/docs/CONTRATOS.md) | The 21 shared artifacts: who writes each, who reads it, when it's deleted |
| [CHANGELOG.md](./CHANGELOG.md) | Breaking changes and migrations, per version |

## Contributing

Issues and pull requests are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md).

The repository has two contexts that must never be confused: `bin/` and `lib/` are the
**generator** (Node.js/ESM), and `templates/` is the **payload** that gets copied into
generated projects. Editing under `templates/` changes the product, not the vehicle.

Four test suites, and running only some of them is how a ratchet stayed red for three rounds
without anyone noticing:

```bash
npm test                  # runs all four
npm run test:cli          # the generator
npm run test:hooks        # the harness hooks
npm run test:guardrails   # the linter's own logic
npm run test:provocacion  # do the 28 rules fire against their violations?
npm run test:integracion  # runs `ng new` for real and lints the output
```

To run the CLI from source:

```bash
git clone https://github.com/Akxlarre/Koa-agent-cli.git
cd Koa-agent-cli
npm install
node bin/index.js
```

A generated project is not kept in-repo on purpose: a checked-in sample drifts from
`templates/` the moment either changes, and a stale copy of the harness sitting next to the
real one is worse than none — it is the first thing an agent finds when it greps.

## License

MIT © [Akxlarre](https://github.com/Akxlarre) — see [LICENSE](./LICENSE).
