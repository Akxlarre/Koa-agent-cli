<div align="center">

# Koa Agent CLI

**Scaffold Angular projects that are native to AI agents — not just AI-assisted.**

[![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen?style=flat-square&logo=nodedotjs)](https://nodejs.org)
[![Angular](https://img.shields.io/badge/Angular-v20-dd0031?style=flat-square&logo=angular)](https://angular.dev)
[![Blueprint](https://img.shields.io/badge/Blueprint-v6.1.0-6366f1?style=flat-square)](./CHANGELOG.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](./LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](./CONTRIBUTING.md)

</div>

---

Most AI coding tools are bolted onto codebases that weren't built for them. Koa Agent CLI takes the opposite approach: it generates Angular projects that ship with a full **agentic harness** out of the box — architectural guardrails, living indexes, and path-scoped rules that keep Claude Code (or any LLM) from drifting.

The result is a project where the agent knows the architecture, can't bypass the rules, and self-documents its own work.

---

## Quick Start

> **Note:** Not yet published to npm. See [Running from Source](#running-from-source) to install locally.

```bash
# Once published:
npx create-koa-agent my-app
cd my-app
ng serve
```

The CLI will prompt you to choose between a **Full Scaffold** (Angular app + boilerplate) or **Inject Only** (add the harness to an existing project).

---

## What You Get

Running a Full Scaffold generates a production-ready Angular 20 project with the following structure:

```
my-app/
├── src/
│   └── app/
│       ├── core/          # Facades, Guards, Services, Models
│       ├── features/      # Smart Components (routable pages)
│       ├── shared/        # Dumb Components (presentational UI)
│       └── layout/        # Shell, Sidebar, Topbar
│
├── .claude/               # The agentic harness
│   ├── CLAUDE.md          # Agent directive: stack, rules, workflow
│   ├── hooks/             # 8 real-time guardrails (pre-write, discovery, etc.)
│   ├── rules/             # 11 path-scoped architectural rules
│   └── skills/            # 7 reusable agent skills (/angular-component, etc.)
│
├── indices/               # Living indexes — the agent's memory
│   ├── COMPONENTS.md      # Every component in the project
│   ├── SERVICES.md        # Every service + facade
│   └── ...6 more indexes
│
├── scripts/
│   ├── architect.js       # AST-based architecture linter
│   └── indices-sync.js    # Auto-index generator
│
├── supabase/              # Supabase migrations + local config
├── docs/                  # Human guides (stack rules, brand, hooks system)
├── .mcp.json              # MCP server manifest (Supabase, etc.)
├── AGENTS.md              # Portable rules for Cursor / Copilot / Windsurf
└── blueprint.json         # Scaffold metadata and stack trace
```

---

## The Agentic Harness

This is the core differentiator. The `.claude/` directory is not documentation — it's active infrastructure.

### Hooks (run automatically on every agent action)

| Hook | Trigger | What it does |
|------|---------|--------------|
| `pre-write-guard` | Before any file write | Runs 4 layers: File Protection → Discovery Gate → Architect Guard → Context Injection |
| `discovery-tracker` | After any file read | Tracks when indexes are read; unlocks the Discovery Gate |
| `failure-tracker` | On tool failure | Logs errors to `LESSONS_LEARNED.md` with dedup and rotation |
| `bash-guard` | Before Bash commands | Blocks file creation via shell (forces Edit/Write tools) |
| `compact-recovery` | On context compact | Re-injects indexes so the agent doesn't lose memory mid-session |
| `write-tracker` | After file writes | Records modified files for the Sync Check |
| `sync-check` | On agent stop | Compares file timestamps vs. indexes; reminds agent to update docs |
| `post-edit` | After file writes | Runs Prettier automatically |

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

Every write is validated in real time. The guard blocks patterns like:

- `*ngIf` / `*ngFor` (use `@if` / `@for`)
- `@Input()` / `@Output()` decorators (use signal-based `input()` / `output()`)
- Hardcoded Tailwind colors (`text-red-500`) — enforces design tokens
- Importing Supabase directly in UI components (use a Facade)
- Components without `OnPush` change detection
- SQL migrations without Row Level Security

---

## Stack

### Default

| Technology | Version | Purpose |
|---|---|---|
| Angular | v20 | Framework (standalone components) |
| Tailwind CSS | v4 | Utility CSS |
| PrimeNG | Latest | UI component library |
| Supabase | Latest | Backend (auth, DB, storage) |
| Vitest | Latest | Unit testing (replaces Karma) |
| Lucide Angular | Latest | Icon library |

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
Generates a complete Angular project from scratch — `ng new` + dependencies + boilerplate code + the full harness.

```bash
npx create-koa-agent my-app
# → Choose "Full Scaffold"
```

### Inject Only
Drops the harness (`.claude/`, `indices/`, `docs/`, `scripts/`) into an **existing** project. Use this to retrofit any Angular codebase with the agentic infrastructure.

```bash
cd my-existing-angular-app
npx create-koa-agent
# → Choose "Inject Only"
```

---

## Agent Workflow (after scaffolding)

Once the project is generated, open Claude Code and run:

```
Apply the conventions in CLAUDE.md and prepare the environment.
```

The agent will read the indexes, understand the architecture, and be ready to build. From there, the built-in npm scripts keep the workflow tight:

```bash
npm run claude:review   # Architecture audit
npm run claude:sync     # Sync living indexes
npm run claude:fix      # Auto-fix lint errors
npm run claude:tdd      # Run tests + auto-fix failures
npm run lint:arch       # Full AST architecture audit
npm run indices:sync    # Regenerate indexes from source
```

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
│   ├── config.js      # Stack resolution + input validation
│   ├── runner.js      # Async spawn wrapper (npm/npx)
│   ├── preflight.js   # System requirements check
│   ├── installer.js   # Angular project creation + npm installs
│   ├── scaffolder.js  # Template copy + file patching
│   └── ui.js          # Terminal output (banner, success message)
└── templates/         # Static payload copied into generated projects
    ├── .claude/       # The harness (hooks, rules, skills)
    ├── boilerplate/   # Angular source boilerplate
    └── indices/       # Empty indexes (filled by the agent)
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
