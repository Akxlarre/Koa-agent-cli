# Project Architecture — AI Agent Guidelines

> This file provides architecture context for AI coding assistants (Cursor, Copilot, Windsurf, Codex, etc.).
> For Claude Code specific features (hooks, skills, memory), see `.claude/CLAUDE.md`.

## Tech Stack
- Angular 20+ (standalone components, signal-based reactivity)
- PrimeNG (UI component library)
- Supabase (BaaS: PostgreSQL + Auth + Realtime) — optional via `--with-supabase`
- Tailwind CSS v4 (utility-first, semantic tokens only)
- GSAP animations — optional via `--with-gsap`

## Architecture Rules

### Folder Structure
```
src/
├── app/
│   ├── core/       # Facades, Services, Guards, Models, Utils (infrastructure)
│   ├── features/   # Smart Components (pages, inject Facades)
│   ├── shared/     # Dumb Components (presentational, input()/output() only)
│   └── layout/     # App shell, sidebar, topbar
├── styles/
│   ├── tokens/     # SCSS variables — NEVER hardcode in components
│   └── vendors/    # PrimeNG overrides
supabase/
└── migrations/     # Idempotent SQL — NEVER alter DB manually
```

### Component Patterns
- ALL components use `ChangeDetectionStrategy.OnPush`
- Smart components (`features/`) inject Facades, coordinate Dumb components
- Dumb components (`shared/`) have ONLY `input()` and `output()` — no service injection
- Use `@if`, `@for`, `@switch` control flow (NOT `*ngIf`, `*ngFor`)
- Use `input()`, `output()` signal API (NOT `@Input()`, `@Output()`)
- Every async Dumb component has a colocated `{name}-skeleton.component.ts`

### State Management
- `signal()` for synchronous UI state (counters, modals, toggles)
- `RxJS` for async flows in Services
- `toSignal()` to expose RxJS to templates via Facades
- `computed()` for derived state
- Components NEVER inject SupabaseService or HttpClient directly — always through Facades
- Facades capture errors with `catchError` and expose an error signal

### Facade Pattern (mandatory)
```typescript
@Injectable({ providedIn: 'root' })
export class ExampleFacade {
  private svc = inject(ExampleService);

  readonly items = toSignal(this.svc.items$, { initialValue: [] });
  readonly error = signal<string | null>(null);

  async create(data: CreateDto): Promise<void> {
    const result = await this.svc.create(data);
    if (result.error) this.error.set(result.error.message);
  }
}
```

### Styling
- NEVER use arbitrary Tailwind colors (`text-red-500`, `bg-[#hex]`)
- ALWAYS use semantic tokens: `text-primary`, `text-muted`, `bg-surface`, `bg-base`
- Brand color: `var(--ds-brand)`, `var(--color-primary)`
- Layout: Bento Grid system (`.bento-grid`, `.bento-wide`, `.bento-tall`, `.bento-feature`)
- Cards: `.card` (base), `.card-accent` (1 per section), `.card-tinted` (KPIs)
- KPI typography: `.kpi-value` + `.kpi-label` (never plain `text-4xl`)

### Icons
- NEVER use emojis as UI icons
- ALWAYS use `<app-icon name="kebab-case" [size]="16" />` for all interface icons
- Icon names match lucide.dev kebab-case names (`"trending-up"`, `"trash-2"`)

### Animations
- Without GSAP (default): CSS `.animate-fade-in-up`, `.animate-stagger` + `withViewTransitions()` in router
- With GSAP (`blueprint.gsap: true`): `GsapAnimationsService` in `ngAfterViewInit`
- NEVER use `@angular/animations`
- ALWAYS respect `prefers-reduced-motion`

### Database
- Migrations in `supabase/migrations/` — idempotent SQL files
- RLS (Row Level Security) REQUIRED on every table
- Never modify database manually — always via migrations
- Naming: `YYYYMMDDHHMMSS_domain_action_description.sql`

### Testing (Vitest)
- Co-located `.spec.ts` files next to source
- Facades and Services: mandatory unit tests
- Utils: mandatory tests (pure functions — easiest to test)
- Dumb components with `computed()`: mandatory tests
- Use `vi.fn()` for mocks (not `jasmine.createSpy`)
- Use `LucideAngularModule.pick({...})` in TestBed imports

## Index Files
Check `indices/` directory for existing components, services, facades, and models
before creating new ones. Reuse first, create second.

- `indices/COMPONENTS.md` — UI components inventory
- `indices/SERVICES.md` — Services and facades inventory
- `indices/FACADES.md` — Facades inventory
- `indices/MODELS.md` — TypeScript interfaces and models
- `indices/DATABASE.md` — Supabase tables and RLS policies
- `indices/ANTI-PATTERNS.md` — Known pitfalls to avoid
