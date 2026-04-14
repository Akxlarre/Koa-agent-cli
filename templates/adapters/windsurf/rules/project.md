# {{PROJECT_NAME}} — Project Rules

Full guidelines are in `AGENTS.md`. This file covers the most critical rules enforced on every edit.

## Session Workflow (mandatory)

1. **DISCOVER** — Read `indices/` (COMPONENTS, SERVICES, FACADES, MODELS, DIRECTIVES, PIPES) and `context/brief.md` before writing code. Never create something that already exists.
2. **PLAN** — State which files you will touch before coding.
3. **EXECUTE** — Follow rules below. Reuse existing code first.
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
- ALWAYS use semantic tokens: `text-primary`, `text-muted`, `bg-base`, `bg-surface`, `var(--ds-brand)`
- NEVER use emojis as icons — ALWAYS use `<app-icon name="kebab-case" [size]="16" />`
- NEVER use `@angular/animations` — ALWAYS use `GsapAnimationsService` in `ngAfterViewInit`

## Anti-Patterns (stop and fix if seen)

- `[ngClass]` → `[class.active]="x()"`
- `@Input()/@Output()` → `input()/output()`
- `inject(SupabaseService)` in UI → use FacadeService
- Arbitrary Tailwind colors → semantic tokens
- `@angular/animations` → GsapAnimationsService
