<div align="center">

# create-koa-agent

Scaffold Angular projects with an agentic harness that enforces its own rules.

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

Most AI coding setups hand the agent a rules file and hope. The rules are advice, nothing
reads them at write time, and the agent's knowledge of the codebase goes stale by week two.

This generates Angular projects where the rules are **executable**: hooks intercept every
write, block what violates the architecture, and say why. The project's indexes are living
memory the agent maintains and the harness verifies. And every check in the box has been
put in front of its own violation — a check that can't fail is worse than no check at all.

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [What you get](#what-you-get)
- [The guardrails](#the-guardrails)
- [The checks that check themselves](#the-checks-that-check-themselves)
- [Two judges](#two-judges)
- [Versioned blueprint](#versioned-blueprint)
- [Feature generator](#feature-generator)
- [Stack](#stack)
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
Scaffold** or **Inject Only**, and which AI tools you use.

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
├── .claude/               # The agentic harness
│   ├── CLAUDE.md          # Agent directive: stack, rules, workflow
│   ├── hooks/             # Real-time guardrails — 18 across 9 events
│   ├── agents/            # 6 subagents with their own context windows
│   ├── rules/             # 16 path-scoped rules — 8 mechanized, 8 social
│   ├── skills/            # 16 agent skills (/plan, /review, …)
│   ├── evals/             # Fixtures with ground truth, to measure the judges
│   └── tests/             # Unit tests for the hooks themselves
│
├── context/               # Semantic seed: brief, domain glossary, constraints
├── indices/               # 15 living indexes — the agent's memory
├── docs/                  # Stack rules, brand guidelines, harness contracts
├── scripts/               # architect.js and the verification suite
├── src/                   # Angular boilerplate: design system, layout, features
└── blueprint.json         # Harness version + managed paths
```

## The guardrails

`.claude/` is not documentation — it's infrastructure that runs.

The agent **cannot** write code before reading the project indexes. It **cannot** commit a
component that isn't registered. It **cannot** hardcode a Tailwind color, inject a Service
into a view component, or ship a migration with a missing RLS policy. It gets blocked, told
which rule and why, and pointed at the fix.

Two of them only fire when the agent is heading somewhere it shouldn't:

- **Circuit Breaker** — a plain `exit 2` is a "no" with no memory, so a blocked agent can
  retry the same write forever. After three identical blocks the guard stops explaining and
  orders an escalation to a human, closing the escape hatches by name.
- **Approval Gate** — `supabase db push`, `db reset`, `migration repair` and destructive
  SQL need a person. Writing the migration is the agent's job; applying it is not.

Every hook ships with its own tests. → [Full hook and rule reference](./docs/MAPA-FUNCIONALIDADES.md)

## The checks that check themselves

A check that exits 0 without looking at anything is **worse than not having it**. The
missing one gets noticed; the decorative one gives you the feeling of being protected, and
that feeling is why nobody looks again.

Two commands ask the question no CI asks — not *do the checks pass*, but *can they fail*:

```bash
npm run lint:arch:provocar   # builds a sandbox per rule containing the minimal file
                             # that violates it, and demands the linter name it. 28/28.
npm run smoke:scripts        # injects a real defect and demands each package.json
                             # script notice. Restores it in a `finally`, always.
```

They exist because of three bugs that lived for months in the codebase this harness came
from: a `tsc --noEmit -p tsconfig.json` that compiled **zero files** and exited 0 (the
Angular CLI's root tsconfig is solution-style); a `node --test` pointed at Deno tests, which
failed every run and read like "there are broken tests"; and an architecture rule that was
written, unit-tested, and **never wired to a caller** — it audited exactly nothing.

Each rule also declares whether a mechanism backs it:

| `enforcement:` | What it means |
|---|---|
| `mecanizada` | A hook or the linter blocks it. The frontmatter names the codes (`ARCH-01`, `A11Y-03`…), so an agent blocked by `[ARCH-12]` can reach the rule that explains it |
| `social` | **Nothing enforces it.** It's a project agreement — break it and no guardrail says a word |

It's **8 and 8**, and a test derives the truth from which codes each mechanism actually
emits, so the label can't lie. → [Why this matters](./templates/docs/CHEQUEOS-QUE-NO-CHEQUEAN.md)

## Two judges

Some failures no regex catches. `/review` triggers on **risk**, not on file count:

| Risk | What defines it | Judges |
|---|---|---|
| 🟢 Low | Styles, docs, comments, tests | None — commit |
| 🟡 Medium | Component logic, facades, repositories, services | `code-judge` |
| 🔴 High | `supabase/migrations/`, auth, guards, RPC, Storage | `code-judge` **+** `security-judge`, in parallel |

At 🔴 the **worst verdict wins**: a security `RECHAZADO` is not offset by an architectural
`APROBADO`. Well-layered code doesn't make an open policy safe. One line in an RLS policy is
more dangerous than five SCSS files, so a 🔴 diff runs both judges even if it touches a
single file.

Neither judge has `Write`, `Edit` or `Bash` — they receive the diff as a file. With `Bash`
they could write using `>`, and "the judge fixes nothing" would be a promise instead of a
fact.

**And the judges are measured.** `.claude/evals/` ships 7 fixtures with ground truth in
their frontmatter — 4 vulnerable, 3 clean controls — and `/eval-jueces` reports recall,
false positives and per-criterion precision. Run it after editing a judge's prompt, before
trusting its verdict. You can't verify the quality of a summary; you *can* verify whether
the judge detects what its rubric promises.

## Versioned blueprint

Every project carries a `blueprint.json` with its harness version and managed paths. That's
what makes the harness upgradable instead of a cloned starter that rots:

```json
{
  "blueprintVersion": "7.2.0",
  "scaffoldMode": "full",
  "stack": { "supabase": true, "primeng": true, "gsap": false },
  "managedPaths": [".claude/", "docs/", "scripts/"]
}
```

Re-running the CLI in Inject Only mode updates the managed paths and leaves everything else
alone. Breaking changes are documented per version in the [CHANGELOG](./CHANGELOG.md).

## Feature generator

Beyond the initial scaffold, the CLI generates full vertical slices inside any Koa project:

```bash
npx create-koa-agent generate feature products
```

Pick the page type — **list** (bento grid + card/skeleton), **detail** (2/3 + 1/3), or
**form** (narrow page) — and it writes the whole slice following the architecture: routable
page, repository, facade with optimistic updates, and colocated Vitest specs. It never
overwrites a file that already exists.

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

## Beyond Claude Code

Claude Code gets the full harness. For other tools the CLI generates adapters that carry
the same rules as prose — `.github/copilot-instructions.md` always, plus `.cursor/rules/`
and `.windsurf/rules/` on request.

Each adapter says so on its first line. Those editors don't run hooks, so **there the rules
are prose, not guardrails**, and the file tells you to run `npm run lint:arch` to verify for
real. A file that reads as if it enforced something it can't is worse than no file.

## How it compares

| | Plain `ng new` | Starter template | Rules file | **create-koa-agent** |
|---|---|---|---|---|
| Architecture conventions | — | Implicit in code | Written down | Written down **and enforced** |
| Agent memory of the codebase | — | — | — | Living indexes + AST auto-indexer |
| Rule violations | — | Silent drift | Agent may ignore | **Blocked in real time** |
| Evolves after day one | — | No (clone & forget) | Manual copy-paste | Versioned blueprint |
| The checks are themselves checked | — | — | — | Every rule provoked against its own violation |

## Honest limits

- **Angular only**, by design — the harness enforces Angular-specific patterns (signals,
  `@if`/`@for`, standalone components).
- **Claude Code gets enforcement.** Cursor, Windsurf and Copilot share the rules but not
  the hooks. The adapters say so.
- **Supabase is the assumed backend** for the data-layer rules. `--no-supabase` skips it
  and thins the harness.
- **Upgrades are documented, not automated.** Inject Only updates the managed paths;
  behavioral migrations follow the CHANGELOG by hand. An `update` command over
  `managedPaths` is the natural next step.

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

Four test suites, and running only some of them is how a ratchet stayed red for three
rounds without anyone noticing:

```bash
npm test              # runs all four
npm run test:cli          # the generator
npm run test:hooks        # the harness hooks
npm run test:guardrails   # the linter's own logic
npm run test:provocacion  # do the 28 rules fire against their violations?
npm run test:integracion  # runs `ng new` for real and lints the output
```

## License

MIT © [Akxlarre](https://github.com/Akxlarre) — see [LICENSE](./LICENSE).
