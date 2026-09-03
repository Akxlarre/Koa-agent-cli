# GitHub Copilot Instructions — {{PROJECT_NAME}}

> **Here the rules are prose, not guardrails.** Koa's harness — the Discovery Gate, the
> Architect Guard, the 28-rule linter — runs as *Claude Code hooks*, and this editor does
> not execute them. Nothing below will **block** you: if you break a rule, the error shows
> up at build time, at review, or in production.
>
> To actually verify a change: run `npm run lint:arch` before committing, or open the
> project with Claude Code, where the same criteria do stop the write.


Read `AGENTS.md` in the project root before starting any task. It contains the mandatory session workflow, full architecture rules, and anti-patterns for this project.

## Critical Rules (Never Violate)

- **Facade Pattern**: NEVER inject `SupabaseService` or `HttpClient` in `features/` or `shared/` — always use a `*FacadeService` from `core/`
- **Template syntax**: NEVER use `*ngIf`, `*ngFor`, `@Input()`, `@Output()` — use `@if`, `@for`, `input()`, `output()`
- **Color tokens**: NEVER hardcode colors (`text-red-500`, `#hex`) — use `text-primary`, `bg-surface`, `var(--ds-brand)`
- **Animations**: NEVER use `@angular/animations` — use `GsapAnimationsService`
- **Change detection**: ALL components must declare `changeDetection: ChangeDetectionStrategy.OnPush`
- **Reuse first**: Check `indices/` before creating any new component, service, facade, or model
