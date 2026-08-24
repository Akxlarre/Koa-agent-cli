<div align="center">

# Koa Agent CLI

**Scaffold Angular projects that are native to AI agents — not just AI-assisted.**

[![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen?style=flat-square&logo=nodedotjs)](https://nodejs.org)
[![Angular](https://img.shields.io/badge/Angular-v20%2B-dd0031?style=flat-square&logo=angular)](https://angular.dev)
[![Blueprint](https://img.shields.io/badge/Blueprint-v6.5.0-6366f1?style=flat-square)](./CHANGELOG.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](./LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](./CONTRIBUTING.md)

</div>

---

Most AI coding tools are bolted onto codebases that weren't built for them. The agent reads a `rules.md`, promises to behave, and drifts anyway — because nothing *enforces* the rules, and nothing keeps its knowledge of the codebase alive.

Koa Agent CLI takes the opposite approach. It generates Angular projects that ship with a full **agentic harness** out of the box:

- **Guardrails, not guidelines.** Hooks intercept every agent action in real time. The agent *cannot* write code before reading the project indexes, *cannot* violate the architecture, *cannot* commit unregistered components. It gets blocked, told why, and pointed to the fix.
- **Living memory.** The project's indexes (components, facades, database schema, anti-patterns) are maintained by the agent itself — enforced by hooks and refreshed by an AST-based auto-indexer.
- **A versioned blueprint.** Every generated project carries a `blueprint.json` with its harness version and managed paths, so the harness can evolve after day one instead of rotting like a cloned starter template.

## Extracted, not invented

This harness was not designed on a whiteboard. It was **extracted from a production Angular + Supabase platform** built almost entirely by AI agents, where every rule exists because its absence caused a real bug, a real regression, or a real week of cleanup. The hooks, the anti-pattern catalog, the index discipline — all of it was battle-tested in production first, then distilled into this CLI. It now powers multiple projects from the same blueprint.

---

## Quick Start

> **Note:** Not yet published to npm. Until then, [run it from source](#running-from-source).

```bash
# Once published:
npx create-koa-agent my-app
cd my-app
ng serve
```

The CLI will prompt you to choose between a **Full Scaffold** (Angular app + boilerplate + harness) or **Inject Only** (add the harness to an existing project), and which AI tools you use (Claude Code, Cursor, Windsurf, Copilot).

---

## What You Get

A Full Scaffold generates a production-ready Angular project (latest stable, standalone components) with this structure:

```
my-app/
├── src/
│   └── app/
│       ├── core/          # Facades, repositories, guards, services, models
│       ├── features/      # Smart Components (routable pages)
│       ├── shared/        # Dumb Components (presentational UI)
│       └── layout/        # Shell, Sidebar, Topbar
│
├── .claude/               # The agentic harness
│   ├── CLAUDE.md          # Agent directive: stack, rules, workflow
│   ├── hooks/             # Real-time guardrails (table below)
│   ├── rules/             # 13 path-scoped architectural rules
│   ├── skills/            # 7 reusable agent skills (/angular-component, …)
│   └── tests/             # Unit tests for the hooks themselves
│
├── context/               # Semantic seed: session brief, domain glossary,
│                          # constraints, decision log
├── indices/               # 11 living indexes — the agent's memory
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
├── docs/                  # Human guides (stack rules, brand, hooks system)
├── .mcp.json              # MCP server manifest (Supabase, etc.)
├── AGENTS.md              # Portable rules for Cursor / Copilot / Windsurf
└── blueprint.json         # Harness version + managed paths (upgrade contract)
```

---

## The Agentic Harness

This is the core differentiator. `.claude/` is not documentation — it's active infrastructure.

### Hooks (run automatically on every agent action)

| Hook | Trigger | What it does |
|------|---------|--------------|
| `pre-write-guard` | Before any file write | Runs 4 layers: File Protection → Discovery Gate → Architect Guard → Context Injection |
| `discovery-tracker` | After any file read | Tracks when indexes are read; unlocks the Discovery Gate |
| `context-guardian` | Session start / writes | Verifies `context/brief.md` exists and is fresh (warns after 7 days); stops the agent from coding blind |
| `bash-guard` | Before Bash commands | Blocks source-file creation via shell (forces Edit/Write so guards can run) |
| `spec-diff-check` | Before `git commit` | Blocks the commit if new components or facades aren't registered in the indexes |
| `failure-tracker` | On tool failure | Logs errors to `LESSONS_LEARNED.md` with dedup and rotation |
| `write-tracker` | After file writes | Records modified files for the Sync Check |
| `compact-recovery` | On context compaction | Re-injects indexes so the agent doesn't lose memory mid-session |
| `sync-check` | On agent stop | Compares file timestamps vs. indexes; reminds the agent to update its memory |
| `post-edit` | After file writes | Runs Prettier automatically |

The hooks ship with their own unit tests (`npm run claude:test-hooks`) — the harness is code, and it's tested like code.

### Discovery Gate in action

The agent **cannot write code** without first reading the project indexes. If it tries, it gets blocked:

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

Every write is validated in real time against the project's architecture. The guard blocks patterns like:

- `*ngIf` / `*ngFor` (use `@if` / `@for`)
- `@Input()` / `@Output()` decorators (use signal-based `input()` / `output()`)
- Hardcoded Tailwind colors (`text-red-500`) — enforces design tokens
- Importing Supabase directly in UI components (use a Facade)
- Components without `OnPush` change detection
- SQL migrations without Row Level Security

Everything the guard enforces in real time is also available as a full audit: `npm run lint:arch` walks the AST of the whole project and reports violations with `[ARCH-NN]` codes and doc links.

### Living indexes

The indexes in `indices/` are the agent's long-term memory: what exists, where it lives, and which mistakes were already made once. Two mechanisms keep them honest:

- **Enforcement** — `spec-diff-check` refuses to commit unregistered components/facades, and `sync-check` flags stale indexes at the end of every session.
- **Automation** — `npm run indices:sync` re-generates the AST-derived sections (with incremental caching by mtime), so the baseline never depends on agent goodwill.

---

## Versioned Blueprint (the anti-drift contract)

Starter templates abandon you the day you clone them. Koa projects don't: every scaffold writes a `blueprint.json` recording the blueprint **version**, the chosen **stack**, and the **managed paths** — the parts of the project owned by the harness (`.claude/**`, `indices/**`, `docs/**`, `scripts/architect.js`, `.mcp.json`) as opposed to your application code.

That contract is what makes upgrades tractable: each release documents its migration path in the [CHANGELOG](./CHANGELOG.md), and the managed-path boundary tells you exactly what is safe to replace. Your harness can keep improving after day one.

---

## Feature Generator

Beyond the initial scaffold, the CLI can generate full vertical slices inside any Koa project (it checks for `blueprint.json` first):

```bash
npx create-koa-agent generate feature my-products
```

Interactive mode lets you pick the page type — **list** (bento-grid + card/skeleton), **detail** (2/3 + 1/3 grid), or **form** (narrow page) — and generates the whole slice following the architecture: routable page, repository, facade with optimistic updates, and colocated Vitest specs.

---

## Stack

### Default

| Technology | Purpose |
|---|---|
| Angular (latest stable, standalone) | Framework |
| Tailwind CSS v4 | Utility CSS on top of semantic design tokens |
| PrimeNG | UI component library |
| Supabase | Backend (auth, DB, storage) + local dev via CLI |
| Vitest | Unit testing (replaces Karma) |
| Lucide Angular | Icon library |

### Opt-in Flags

```bash
npx create-koa-agent my-app --with-gsap          # GSAP animations
npx create-koa-agent my-app --with-ngrx-signals  # NgRx Signal Store
npx create-koa-agent my-app --with-e2e           # Playwright E2E tests
npx create-koa-agent my-app --no-supabase        # Skip Supabase
npx create-koa-agent my-app --no-primeng         # Skip PrimeNG
```

Or use a `koa-config.json` file in your working directory for persistent defaults:

```json
{
  "stack": {
    "gsap": true,
    "e2e": false,
    "supabase": true
  }
}
```

---

## Two Modes

### Full Scaffold
Generates a complete Angular project from scratch — `ng new` + dependencies + boilerplate + the full harness. Scaffolding runs in a temp directory with automatic rollback, so a failed run never leaves a half-built project behind.

```bash
npx create-koa-agent my-app
# → Choose "Full Scaffold"
```

### Inject Only
Drops the harness (`.claude/`, `indices/`, `context/`, `docs/`, `scripts/`) into an **existing** project. Use this to retrofit any Angular codebase with the agentic infrastructure.

```bash
cd my-existing-angular-app
npx create-koa-agent
# → Choose "Inject Only"
```

---

## Beyond Claude Code

The harness is Claude Code-first (hooks are its native mechanism), but the rules travel:

- **`AGENTS.md`** — portable directive picked up by most agentic tools
- **Cursor** — `.cursor/rules/*.mdc` adapters (architecture + workflow)
- **Windsurf** — `.windsurf/rules/` adapter
- **GitHub Copilot** — `copilot-instructions.md`

The CLI asks which tools you use and installs the matching adapters. Note that only Claude Code gets *enforcement* — other tools get the rules as strongly-worded guidance.

---

## Agent Workflow (after scaffolding)

Open Claude Code in the generated project and run:

```
Apply the conventions in CLAUDE.md and prepare the environment.
```

The agent reads the indexes and the `context/` brief, understands the architecture, and is ready to build. The built-in npm scripts keep the loop tight:

```bash
npm run lint:arch           # Full AST architecture audit
npm run indices:sync        # Regenerate indexes from source
npm run claude:review       # Headless architecture review of the session
npm run claude:sync         # Ask the agent to sync the living indexes
npm run claude:fix          # Run ng lint, auto-fix errors
npm run claude:tdd          # Run tests, auto-fix failures until green
npm run claude:test-hooks   # Unit-test the harness hooks themselves
npm run supabase:start      # Local Supabase (plus stop / reset / diff / types)
```

---

## How It Compares

| | Plain `ng new` | Starter template | Rules file (`.cursorrules` etc.) | **Koa Agent CLI** |
|---|---|---|---|---|
| Architecture conventions | — | Implicit in code | Written down | Written down **and enforced** |
| Agent memory of the codebase | — | — | — | Living indexes + auto-indexer |
| Rule violations | — | Silent drift | Agent may ignore | **Blocked in real time** |
| Evolves after day one | — | No (clone & forget) | Manual copy-paste | Versioned blueprint + migrations |
| Lessons from failures | — | — | — | `LESSONS_LEARNED.md` + `ANTI-PATTERNS.md` |

## Honest Limits

- **Angular-only** (by design — the harness enforces Angular-specific patterns like signals and `@if`/`@for`).
- **Claude Code gets the full experience.** Cursor/Windsurf/Copilot adapters share the rules but not the enforcement hooks.
- **Supabase is the assumed backend** for the data-layer rules; `--no-supabase` skips it but thins the harness.
- **Upgrades are documented, not yet automated** — migrations between blueprint versions follow the CHANGELOG manually (an `update` command over `managedPaths` is the natural next step).

---

## Running from Source

```bash
git clone https://github.com/Akxlarre/Koa-agent-cli.git
cd koa-agent-cli
npm install
npm link
```

After linking, `create-koa-agent` is available as a global command.

```bash
create-koa-agent my-app
```

To run without linking:

```bash
node bin/index.js
```

### Prerequisites

- Node.js v20+
- npm v9+
- Git (recommended)
- Docker (optional, for Supabase local development)

---

## Project Structure (CLI repo)

```
koa-agent-cli/
├── bin/index.js       # Entry point: flags, prompts, orchestration
├── lib/
│   ├── config.js      # Stack resolution, blueprint schema, input validation
│   ├── preflight.js   # System requirements check
│   ├── runner.js      # Async spawn wrapper (npm/npx)
│   ├── installer.js   # Angular project creation + dependency installs
│   ├── scaffolder.js  # Template copy, file patching, blueprint.json
│   ├── generator.js   # `generate feature` — vertical slice generator
│   ├── feature-templates.js # Templates used by the generator
│   └── ui.js          # Terminal output (banner, success message)
├── templates/         # Static payload copied into generated projects
│   ├── .claude/       # The harness (hooks, rules, skills, hook tests)
│   ├── context/       # Semantic seed files (brief, domain, constraints)
│   ├── indices/       # Index skeletons (filled by the agent)
│   ├── boilerplate/   # Angular source boilerplate (+ -e2e, -ngrx variants)
│   ├── adapters/      # Cursor / Windsurf / Copilot rule adapters
│   ├── docs/          # Human-facing guides
│   └── supabase/      # Supabase local config + migrations dir
└── ok-project/        # Reference output — a generated project kept in-repo
                       # as a living example of what the scaffold produces
```

---

## Contributing

Contributions are welcome. Please open an issue before submitting a pull request for significant changes.

When working on this repo, note the dual context:

- **`bin/` + `lib/`** — CLI code (Node.js/ESM). Rules in `.claude/rules/cli-architecture.md`.
- **`templates/`** — payload that gets copied to generated projects. Changes here affect all future scaffolds. Rules in `.claude/rules/templates-contract.md`.

The repo has its own agentic harness (`.claude/`) that enforces these boundaries automatically when working with Claude Code.

---

## License

MIT © [Akxlarre](https://github.com/Akxlarre)
