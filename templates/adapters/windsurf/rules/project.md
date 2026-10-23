# {{PROJECT_NAME}} — Project Rules

Full guidelines are in `AGENTS.md`. This file covers the most critical rules of the project.

> **Here the rules are prose, not guardrails.** Koa's harness — the Discovery Gate, the
> Architect Guard, the 28-rule linter — runs as *Claude Code hooks*, and this editor does
> not execute them. Nothing below will **block** you: if you break a rule, the error shows
> up at build time, at review, or in production.
>
> To actually verify a change: run `npm run lint:arch` before committing, or open the
> project with Claude Code, where the same criteria do stop the write.


## Session Workflow (mandatory)

1. **DISCOVER** — Read `indices/` (COMPONENTS, SERVICES, FACADES, MODELS, DIRECTIVES, PIPES) and `context/brief.md` before writing code. Never create something that already exists.
2. **PLAN** — State which files you will touch before coding.
3. **EXECUTE** — One usable vertical slice at a time, never layer by layer. Failing test committed alone first. Reuse existing code first.
4. **VALIDATE** — Run `npm run lint:arch`.
5. **SYNC** — Update `indices/*.md` at the end of the session.

## Template Syntax

NEVER: `*ngIf`, `*ngFor`, `@Input()`, `@Output()`, `[ngClass]`, `[ngStyle]`
ALWAYS: `@if`, `@for`, `input()`, `output()`, `[class.name]="expr()"`, `[style.prop]="expr()"`

## Facade Pattern

- Components in `features/` and `shared/` NEVER inject `SupabaseService` or `HttpClient` directly
- ALWAYS use a `*FacadeService` from `core/` that exposes state via `toSignal()`
- Facades handle errors: `catchError` + `error = signal<string | null>(null)`

## Components

- `changeDetection: ChangeDetectionStrategy.OnPush` — every component, no exceptions
- Dumb (`shared/`): only `input()` and `output()`, no service injection
- Smart (`features/`): inject Facades, coordinate Dumb components
- Every async Dumb component needs a colocated `{name}-skeleton.component.ts`

## Visual System

- NEVER hardcode colors: no `text-red-500`, `bg-blue-200`, `#hex` values
- ALWAYS use semantic tokens: `text-primary`, `text-muted`, `bg-canvas`, `bg-surface`, `var(--ds-brand)`
- NEVER use emojis as icons — ALWAYS use `<app-icon name="kebab-case" [size]="16" />`
- NEVER use `@angular/animations` — ALWAYS use `GsapAnimationsService` in `ngAfterViewInit`

## Anti-Patterns (stop and fix if seen)

- `[ngClass]` → `[class.active]="x()"`
- `@Input()/@Output()` → `input()/output()`
- `inject(SupabaseService)` in UI → use FacadeService
- Arbitrary Tailwind colors → semantic tokens
- `@angular/animations` → GsapAnimationsService
