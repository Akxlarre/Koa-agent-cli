# Contributing to Koa Agent CLI

Thanks for your interest. This guide covers everything you need to contribute effectively.

## Before you start

Open an issue before submitting a PR for significant changes. This saves both of us time — the change might already be in progress, or there may be design constraints worth discussing first.

For small fixes (typos, broken links, obvious bugs) you can go straight to a PR.

---

## Setup

```bash
git clone https://github.com/Akxlarre/Koa-agent-cli.git
cd koa-agent-cli
npm install
npm link
```

After `npm link`, `create-koa-agent` is available globally. Test your changes with:

```bash
# Test inject-only mode (fast, no ng new)
TEST_MODE=inject node bin/index.js

# Test full scaffold (slow, runs ng new — use a temp dir outside this repo)
cd /tmp
create-koa-agent test-project
```

> **Important:** Never run `TEST_MODE=inject` from inside the CLI repo itself. The CLI copies `templates/` into the current directory, which overwrites the repo's own `.claude/` harness.

---

## Repo structure

This repo has two distinct contexts that must not be confused:

| Directory | What it is | Rules |
|---|---|---|
| `bin/` + `lib/` | The CLI itself (Node.js/ESM) | `cli-architecture.md` |
| `templates/` | Static payload copied to generated projects | `templates-contract.md` |

Changes to `templates/` affect **all future scaffolds**. Changes to `lib/` affect the CLI behavior. They are independent — keep them that way.

### CLI modules

```
bin/index.js      Entry point — orchestration only (≤150 lines, and there's a test)
lib/config.js     Stack resolution + input validation
lib/runner.js     Async spawn wrapper (npm/npx)
lib/preflight.js  System requirements check
lib/installer.js  Angular project creation + npm installs
lib/scaffolder.js Template copy + file patching
lib/prompts.js    Inquirer prompts + TEST_MODE (no FS, no spawn)
lib/generator.js  `generate feature` subcommand
lib/ui.js         Terminal output only (no FS, no spawn)
```

The rule: each module does one thing. `scaffolder.js` never runs npm. `installer.js` never copies files. If you find yourself breaking this, the code belongs in a different module.

---

## Tests

```bash
npm test               # fast — no network, seconds
npm run test:integracion   # runs `ng new` for real: needs network, ~1 min
```

The fast suite covers module contracts against a project shaped the way we *believe*
`ng new` shapes it. The integration suite generates a real Angular project and runs
the scaffolder on it — that's the one that notices when Angular changes that shape.
Run it before publishing.

Patches to `tsconfig.json`, `angular.json` and `package.json` are **required**: if the
file isn't there, the CLI stops instead of quietly producing a project that doesn't
compile. Adding a patch for a file that may legitimately be absent? Use
`patch(file, { requerido: false, que: '…' }, fn)` — it prints a line rather than
saying nothing.

---

## Working with the harness

This repo has its own `.claude/` directory for Claude Code users. If you're contributing with Claude Code:

1. Read `indices/CLI-MODULES.md` and `indices/TEMPLATES-REGISTRY.md` first — the Discovery Gate will block you if you don't.
2. The `pre-write-guard` hook injects context reminding you which context (CLI vs. templates) you're in.
3. After adding or modifying modules, update `indices/CLI-MODULES.md`.

---

## What to contribute

Areas where contributions are most useful:

- **New opt-in stack flags** — additional libraries that follow the same pattern as `--with-gsap` / `--with-e2e`
- **Template improvements** — better boilerplate components, updated hooks, new rules
- **Windows compatibility** — the CLI is tested on Windows but edge cases exist
- **Bug fixes** — especially around the patching logic in `lib/scaffolder.js`
- **Documentation** — keeping `indices/TEMPLATES-REGISTRY.md` accurate as templates evolve

---

## Code style

- ESM throughout (`import`/`export`) — no `require()` in `bin/` or `lib/`
- Hooks in `.claude/hooks/` are CommonJS — keep them that way
- No external dependencies beyond what's in `package.json` — keep the CLI lightweight
- No TypeScript in the CLI itself — plain Node.js is intentional

---

## Submitting a PR

1. Fork the repo and create a branch from `master`
2. Make your changes
3. Test with `TEST_MODE=inject node bin/index.js` at minimum
4. Update `indices/CLI-MODULES.md` or `indices/TEMPLATES-REGISTRY.md` if you changed the architecture
5. Open a PR with a clear description of what changed and why

---

## Reporting bugs

Open a GitHub issue with:
- Node.js version (`node --version`)
- OS and shell
- The exact command you ran
- The full error output
