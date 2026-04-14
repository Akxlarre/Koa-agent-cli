/**
 * lib/feature-templates.js — Plantillas de código para `generate feature`
 *
 * Cada template usa tres variables:
 *   {{domain}}   — kebab-case plural  (ej: productos)
 *   {{Domain}}   — PascalCase singular (ej: Producto)
 *   {{Domains}}  — PascalCase plural   (ej: Productos)
 *
 * Los templates siguen la arquitectura canónica del Blueprint:
 *   UI → Facade (BaseFacade) → Repository → SupabaseService
 */

export const FEATURE_TEMPLATES = {

  // ── 1. Repository ────────────────────────────────────────────────────────

  repository: `import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '@core/services/supabase.service';

/**
 * Fila de la tabla \`{{domain}}\` devuelta por Supabase.
 * TODO: reemplaza los campos con los de tu tabla real.
 * Tip: ejecuta \`npm run supabase:types\` para generar tipos automáticamente.
 */
export interface {{Domain}}Row {
  id: string;
  created_at: string;
  // TODO: agregar columnas de la tabla {{domain}}
}

/**
 * {{Domains}}Repository — acceso tipado a la tabla \`{{domain}}\`.
 * ÚNICO lugar que llama .client.from('{{domain}}').
 * Los Facades inyectan este repository; la UI nunca lo inyecta directamente.
 */
@Injectable({ providedIn: 'root' })
export class {{Domains}}Repository {
  private client = inject(SupabaseService).db;

  async findAll(): Promise<{{Domain}}Row[]> {
    const { data, error } = await this.client
      .from('{{domain}}')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async findById(id: string): Promise<{{Domain}}Row | null> {
    try {
      const { data } = await this.client
        .from('{{domain}}')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      return data ?? null;
    } catch {
      return null;
    }
  }

  async create(payload: Omit<{{Domain}}Row, 'id' | 'created_at'>): Promise<{{Domain}}Row> {
    const { data, error } = await this.client
      .from('{{domain}}')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async update(id: string, patch: Partial<Omit<{{Domain}}Row, 'id' | 'created_at'>>): Promise<void> {
    const { error } = await this.client
      .from('{{domain}}')
      .update(patch)
      .eq('id', id);
    if (error) throw error;
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.client
      .from('{{domain}}')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
}
`,

  // ── 2. Facade ────────────────────────────────────────────────────────────

  facade: `import { Injectable, inject } from '@angular/core';
import { BaseFacade } from '@core/facades/base.facade';
import { {{Domains}}Repository } from '@core/repositories/{{domain}}.repository';
import { ToastService } from '@core/services/toast.service';
import type { {{Domain}}Row } from '@core/repositories/{{domain}}.repository';

@Injectable({ providedIn: 'root' })
export class {{Domains}}Facade extends BaseFacade<{{Domain}}Row[]> {
  private repo = inject({{Domains}}Repository);
  private toast = inject(ToastService);

  // ── Fetch (contrato de BaseFacade) ─────────────────────────────────────

  protected override async fetchData(): Promise<{{Domain}}Row[]> {
    return this.repo.findAll();
  }

  // ── Mutaciones (patrón optimistic-first) ──────────────────────────────

  async crear(payload: Omit<{{Domain}}Row, 'id' | 'created_at'>): Promise<boolean> {
    const optimistic = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...payload } as {{Domain}}Row;
    const prev = this._data();
    this._data.update(items => [optimistic, ...(items ?? [])]);

    try {
      const created = await this.repo.create(payload);
      this._data.update(items => items?.map(i => i.id === optimistic.id ? created : i) ?? []);
      this.toast.success('{{Domain}} creado correctamente');
      return true;
    } catch {
      this._data.set(prev);
      this.toast.error('No se pudo crear el {{domain}}');
      return false;
    }
  }

  async eliminar(id: string): Promise<boolean> {
    const prev = this._data();
    this._data.update(items => items?.filter(i => i.id !== id) ?? []);

    try {
      await this.repo.remove(id);
      this.toast.success('{{Domain}} eliminado');
      return true;
    } catch {
      this._data.set(prev);
      this.toast.error('No se pudo eliminar el {{domain}}');
      return false;
    }
  }
}
`,

  // ── 3. Smart Component (página) ──────────────────────────────────────────

  'smart-page': `import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
  DestroyRef,
} from '@angular/core';
import { {{Domains}}Facade } from '@core/facades/{{domain}}.facade';
import { {{Domain}}CardComponent } from '@shared/components/{{domain}}-card/{{domain}}-card.component';
import { {{Domain}}CardSkeletonComponent } from '@shared/components/{{domain}}-card/{{domain}}-card-skeleton.component';
import { ErrorStateComponent } from '@shared/components/error-state/error-state.component';

@Component({
  selector: 'app-{{domain}}',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [{{Domain}}CardComponent, {{Domain}}CardSkeletonComponent, ErrorStateComponent],
  template: \`
    <div class="bento-grid" appBentoGridLayout>

      @if (facade.isLoading() && !facade.hasData()) {
        @for (_ of skeletons; track $index) {
          <app-{{domain}}-card-skeleton class="bento-square" />
        }
      } @else if (facade.error()) {
        <app-error-state
          class="col-span-full"
          [message]="facade.error()!"
          (retry)="facade.retryLoad()"
        />
      } @else {
        @for (item of facade.data(); track item.id) {
          <app-{{domain}}-card
            class="bento-square"
            [item]="item"
            (eliminar)="onEliminar(item.id)"
          />
        } @empty {
          <div class="card col-span-full">
            <p class="text-muted">No hay {{domain}} todavía.</p>
          </div>
        }
      }

    </div>
  \`,
})
export class {{Domains}}Component implements OnInit {
  protected readonly facade = inject({{Domains}}Facade);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly skeletons = Array(6);

  ngOnInit(): void {
    this.facade.initialize();
    this.destroyRef.onDestroy(() => this.facade.dispose());
  }

  protected onEliminar(id: string): void {
    this.facade.eliminar(id);
  }
}
`,

  // ── 4. Dumb Card Component ───────────────────────────────────────────────

  'dumb-card': `import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import type { {{Domain}}Row } from '@core/repositories/{{domain}}.repository';

@Component({
  selector: 'app-{{domain}}-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: \`
    <div class="card h-full flex flex-col gap-3">

      <!-- TODO: reemplaza con los campos reales de {{Domain}}Row -->
      <p class="text-primary font-semibold truncate">{{ item().id }}</p>
      <p class="text-muted text-sm">{{ item().created_at }}</p>

      <div class="flex gap-2 mt-auto">
        <button
          class="btn-ghost"
          [attr.aria-label]="'Eliminar ' + item().id"
          data-llm-action="delete-{{domain}}"
          (click)="eliminar.emit()"
        >
          <app-icon name="trash-2" [size]="16" ariaHidden="true" />
        </button>
      </div>

    </div>
  \`,
})
export class {{Domain}}CardComponent {
  readonly item = input.required<{{Domain}}Row>();
  readonly eliminar = output<void>();
}
`,

  // ── 5. Skeleton Card Component ───────────────────────────────────────────

  'dumb-skeleton': `import { Component, ChangeDetectionStrategy } from '@angular/core';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';

@Component({
  selector: 'app-{{domain}}-card-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonBlockComponent],
  template: \`
    <div class="card h-full flex flex-col gap-3">
      <skeleton-block variant="text" />
      <skeleton-block variant="text" width="60%" />
      <skeleton-block variant="text" width="40%" />
    </div>
  \`,
})
export class {{Domain}}CardSkeletonComponent {}
`,

  // ── 6. Repository Spec (stub) ────────────────────────────────────────────

  'repository-spec': `import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { {{Domains}}Repository } from './{{domain}}.repository';
import { SupabaseService } from '@core/services/supabase.service';

// TODO: adapta la cadena de mock a los métodos reales de tu repository.
// Ejemplo para findAll() con .select().order():
function buildClientMock(result: { data: unknown; error: null }) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue(result),
      }),
    }),
  };
}

describe('{{Domains}}Repository', () => {
  let repo: {{Domains}}Repository;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: SupabaseService, useValue: { db: buildClientMock({ data: [], error: null }) } },
      ],
    });
    repo = TestBed.inject({{Domains}}Repository);
  });

  it('should be created', () => {
    expect(repo).toBeTruthy();
  });

  it('findAll() should return an array', async () => {
    const result = await repo.findAll();
    expect(Array.isArray(result)).toBe(true);
  });

  it('findAll() should query the {{domain}} table', async () => {
    const dbMock = buildClientMock({ data: [], error: null });
    TestBed.overrideProvider(SupabaseService, { useValue: { db: dbMock } });
    repo = TestBed.inject({{Domains}}Repository);

    await repo.findAll();
    expect(dbMock.from).toHaveBeenCalledWith('{{domain}}');
  });

  // TODO: agregar tests para findById(), create(), update(), remove()
});
`,

  // ── 7. Facade Spec (stub) ────────────────────────────────────────────────

  'facade-spec': `import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { {{Domains}}Facade } from './{{domain}}.facade';
import { {{Domains}}Repository } from '@core/repositories/{{domain}}.repository';
import { ToastService } from '@core/services/toast.service';
import type { {{Domain}}Row } from '@core/repositories/{{domain}}.repository';

const MOCK_ITEM: {{Domain}}Row = {
  id: 'test-id-1',
  created_at: new Date().toISOString(),
  // TODO: completar con los campos reales de {{Domain}}Row
};

describe('{{Domains}}Facade', () => {
  let facade: {{Domains}}Facade;
  let repoSpy: {
    findAll: ReturnType<typeof vi.fn>;
    create:  ReturnType<typeof vi.fn>;
    remove:  ReturnType<typeof vi.fn>;
    update:  ReturnType<typeof vi.fn>;
  };
  let toastSpy: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repoSpy = {
      findAll: vi.fn().mockResolvedValue([]),
      create:  vi.fn().mockResolvedValue({ ...MOCK_ITEM, id: 'server-id' }),
      remove:  vi.fn().mockResolvedValue(undefined),
      update:  vi.fn().mockResolvedValue(undefined),
    };
    toastSpy = { success: vi.fn(), error: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: {{Domains}}Repository, useValue: repoSpy },
        { provide: ToastService,          useValue: toastSpy },
      ],
    });

    facade = TestBed.inject({{Domains}}Facade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  // ── SWR ───────────────────────────────────────────────────────────────────

  it('initialize() — primera carga: llama fetchData y setea data', async () => {
    repoSpy.findAll.mockResolvedValueOnce([MOCK_ITEM]);
    await facade.initialize();
    expect(facade.data()).toHaveLength(1);
    expect(facade.isLoading()).toBe(false);
  });

  it('initialize() — re-entry SWR: no muestra skeleton', async () => {
    await facade.initialize();
    facade.initialize(); // segunda llamada — sin await intencionado
    expect(facade.isLoading()).toBe(false);
  });

  // ── Mutaciones ────────────────────────────────────────────────────────────

  it('crear() — optimistic update: agrega el item antes de la respuesta', async () => {
    await facade.initialize();
    const { id: _id, created_at: _ca, ...payload } = MOCK_ITEM;
    const promise = facade.crear(payload as any);
    expect(facade.data()!.length).toBeGreaterThan(0); // optimistic
    await promise;
  });

  it('crear() — rollback si el repo falla', async () => {
    await facade.initialize();
    repoSpy.create.mockRejectedValueOnce(new Error('DB error'));
    const { id: _id, created_at: _ca, ...payload } = MOCK_ITEM;
    await facade.crear(payload as any);
    expect(facade.data()).toHaveLength(0); // rollback
    expect(toastSpy.error).toHaveBeenCalledTimes(1);
  });

  it('eliminar() — optimistic delete: elimina inmediatamente', async () => {
    repoSpy.findAll.mockResolvedValueOnce([MOCK_ITEM]);
    await facade.initialize();
    facade.eliminar(MOCK_ITEM.id);
    expect(facade.data()!.find(i => i.id === MOCK_ITEM.id)).toBeUndefined();
  });

  it('eliminar() — rollback si el repo falla', async () => {
    repoSpy.findAll.mockResolvedValueOnce([MOCK_ITEM]);
    await facade.initialize();
    repoSpy.remove.mockRejectedValueOnce(new Error('DB error'));
    await facade.eliminar(MOCK_ITEM.id);
    expect(facade.data()).toHaveLength(1); // rollback
    expect(toastSpy.error).toHaveBeenCalledTimes(1);
  });

  // TODO: agregar tests para métodos adicionales del facade
});
`,

  // ── 8. Detail Facade ─────────────────────────────────────────────────────────

  'facade-detail': `import { Injectable, inject, signal } from '@angular/core';
import { BaseFacade } from '@core/facades/base.facade';
import { {{Domains}}Repository } from '@core/repositories/{{domain}}.repository';
import { ToastService } from '@core/services/toast.service';
import type { {{Domain}}Row } from '@core/repositories/{{domain}}.repository';

/**
 * {{Domains}}Facade (detail) — gestiona el estado de UN único {{Domain}}.
 * Úsalo en páginas de ficha detalle (arquetipo: detail).
 *
 * Para páginas de lista usa el facade base (facade.ts).
 */
@Injectable({ providedIn: 'root' })
export class {{Domains}}Facade extends BaseFacade<{{Domain}}Row | null> {
  private repo = inject({{Domains}}Repository);
  private toast = inject(ToastService);

  /** ID actualmente cargado — privado, solo para fetchData. */
  private _currentId = signal<string | null>(null);

  // ── fetchData (contrato de BaseFacade) ────────────────────────────────────

  protected override async fetchData(): Promise<{{Domain}}Row | null> {
    const id = this._currentId();
    return id ? this.repo.findById(id) : null;
  }

  // ── Carga por ID ─────────────────────────────────────────────────────────

  /**
   * Carga el {{Domain}} con el ID dado.
   * - Si el ID cambia: resetea el estado y hace fetch completo.
   * - Si el ID es el mismo: aplica SWR (muestra dato cacheado, refresca en segundo plano).
   */
  async loadById(id: string): Promise<void> {
    if (this._currentId() !== id) {
      this._currentId.set(id);
      this.reset();
    }
    await this.initialize();
  }

  // ── Mutación: actualizar ─────────────────────────────────────────────────

  async actualizar(patch: Partial<Omit<{{Domain}}Row, 'id' | 'created_at'>>): Promise<boolean> {
    const id = this._currentId();
    if (!id) return false;

    const prev = this._data();
    this._data.update(item => item ? { ...item, ...patch } : item);

    try {
      await this.repo.update(id, patch);
      this.toast.success('{{Domain}} actualizado correctamente');
      return true;
    } catch {
      this._data.set(prev);
      this.toast.error('No se pudo actualizar el {{domain}}');
      return false;
    }
  }
}
`,

  // ── 9. Smart Detail Page ──────────────────────────────────────────────────

  'smart-page-detail': `import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
  DestroyRef,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { {{Domains}}Facade } from '@core/facades/{{domain}}.facade';
import { ErrorStateComponent } from '@shared/components/error-state/error-state.component';

@Component({
  selector: 'app-{{domain}}-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ErrorStateComponent],
  template: \`
    @if (facade.isLoading() && !facade.hasData()) {
      <div class="card"><p class="text-muted">Cargando...</p></div>

    } @else if (facade.error()) {
      <app-error-state
        [message]="facade.error()!"
        (retry)="facade.retryLoad()"
      />

    } @else if (!facade.data()) {
      <div class="card"><p class="text-muted">{{Domain}} no encontrado.</p></div>

    } @else {

      <!-- Header: .card-accent (máx. 1 por vista) -->
      <div class="card card-accent flex items-center justify-between mb-6">
        <div>
          <!-- TODO: reemplaza con los campos descriptivos de {{Domain}}Row -->
          <h1 class="text-primary font-semibold">{{ facade.data()!.id }}</h1>
          <p class="text-muted text-sm">{{ facade.data()!.created_at }}</p>
        </div>
        <div class="flex gap-2">
          <button class="btn-ghost" data-llm-action="editar-{{domain}}" (click)="onEditar()">Editar</button>
          <button class="btn-ghost" (click)="onVolver()">Volver</button>
        </div>
      </div>

      <!-- Grid principal: 2/3 contenido + 1/3 lateral -->
      <div class="grid grid-cols-3 gap-6">

        <div class="col-span-2 flex flex-col gap-6">
          <div class="card">
            <!-- TODO: campos principales de {{Domain}}Row -->
            <p class="text-secondary">Sección principal</p>
          </div>
        </div>

        <aside class="flex flex-col gap-6">
          <div class="card">
            <!-- TODO: metadatos / acciones secundarias -->
            <p class="text-muted text-sm">Panel lateral</p>
          </div>
        </aside>

      </div>
    }
  \`,
})
export class {{Domains}}DetailComponent implements OnInit {
  protected readonly facade = inject({{Domains}}Facade);
  private readonly route    = inject(ActivatedRoute);
  private readonly router   = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.facade.loadById(id);
    this.destroyRef.onDestroy(() => this.facade.dispose());
  }

  protected onEditar(): void {
    // TODO: abrir <app-drawer> inline o navegar a /{{domain}}/:id/edit
  }

  protected onVolver(): void {
    this.router.navigate(['../'], { relativeTo: this.route });
  }
}
`,

  // ── 10. Smart Form Page ───────────────────────────────────────────────────

  'smart-page-form': `import {
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { {{Domains}}Facade } from '@core/facades/{{domain}}.facade';
import { ErrorStateComponent } from '@shared/components/error-state/error-state.component';

@Component({
  selector: 'app-{{domain}}-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ErrorStateComponent],
  template: \`
    <div class="page-narrow">

      <!-- Breadcrumb + título plano (arquetipo form: sin hero visual) -->
      <div class="mb-6">
        <p class="text-muted text-sm">
          <span
            class="hover:text-primary cursor-pointer"
            (click)="onVolver()"
          >{{Domains}}</span>
          / Nuevo
        </p>
        <h1 class="text-primary font-semibold mt-1">Nuevo {{Domain}}</h1>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="card flex flex-col gap-4">

        <!-- TODO: reemplaza con los campos reales de {{Domain}}Row (excluye id y created_at) -->
        <div class="flex flex-col gap-1">
          <label class="text-secondary text-sm font-medium" for="exampleField">
            Campo de ejemplo
          </label>
          <input
            id="exampleField"
            pInputText
            formControlName="exampleField"
            placeholder="Escribe aquí..."
          />
        </div>

        @if (facade.error()) {
          <app-error-state
            title="No se pudo guardar"
            [message]="facade.error()!"
            retryLabel="Reintentar"
            (retry)="onSubmit()"
          />
        }

        <div class="flex justify-end gap-2 mt-2">
          <button type="button" class="btn-ghost" (click)="onVolver()">
            Cancelar
          </button>
          <button
            type="submit"
            class="btn-primary"
            data-llm-action="crear-{{domain}}"
            [disabled]="form.invalid || facade.isLoading()"
          >
            @if (facade.isLoading()) { Guardando... } @else { Guardar }
          </button>
        </div>

      </form>
    </div>
  \`,
})
export class {{Domains}}FormComponent implements OnInit {
  protected readonly facade = inject({{Domains}}Facade);
  private readonly fb       = inject(FormBuilder);
  private readonly router   = inject(Router);
  private readonly route    = inject(ActivatedRoute);

  protected readonly form = this.fb.nonNullable.group({
    // TODO: agregar los campos de {{Domain}}Row (excepto id y created_at)
    exampleField: ['', Validators.required],
  });

  ngOnInit(): void {
    this.facade.initialize();
  }

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    const ok = await this.facade.crear(this.form.getRawValue() as any);
    if (ok) this.router.navigate(['../'], { relativeTo: this.route });
  }

  protected onVolver(): void {
    this.router.navigate(['../'], { relativeTo: this.route });
  }
}
`,

  // ── 11. Detail Facade Spec ────────────────────────────────────────────────

  'facade-detail-spec': `import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { {{Domains}}Facade } from './{{domain}}.facade';
import { {{Domains}}Repository } from '@core/repositories/{{domain}}.repository';
import { ToastService } from '@core/services/toast.service';
import type { {{Domain}}Row } from '@core/repositories/{{domain}}.repository';

const MOCK_ITEM: {{Domain}}Row = {
  id: 'test-id-1',
  created_at: new Date().toISOString(),
  // TODO: completar con los campos reales de {{Domain}}Row
};

describe('{{Domains}}Facade (detail)', () => {
  let facade: {{Domains}}Facade;
  let repoSpy: {
    findById: ReturnType<typeof vi.fn>;
    update:   ReturnType<typeof vi.fn>;
  };
  let toastSpy: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repoSpy = {
      findById: vi.fn().mockResolvedValue(MOCK_ITEM),
      update:   vi.fn().mockResolvedValue(undefined),
    };
    toastSpy = { success: vi.fn(), error: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: {{Domains}}Repository, useValue: repoSpy },
        { provide: ToastService,          useValue: toastSpy },
      ],
    });

    facade = TestBed.inject({{Domains}}Facade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  // ── loadById ──────────────────────────────────────────────────────────────

  it('loadById() — primera carga: setea data y sale de loading', async () => {
    await facade.loadById(MOCK_ITEM.id);
    expect(facade.data()).toEqual(MOCK_ITEM);
    expect(facade.isLoading()).toBe(false);
  });

  it('loadById() — mismo ID (SWR): no muestra skeleton', async () => {
    await facade.loadById(MOCK_ITEM.id);
    facade.loadById(MOCK_ITEM.id); // segunda llamada sin await — SWR
    expect(facade.isLoading()).toBe(false); // stale data disponible inmediatamente
  });

  it('loadById() — ID diferente: resetea el estado y hace fetch limpio', async () => {
    await facade.loadById(MOCK_ITEM.id);
    repoSpy.findById.mockResolvedValueOnce({ ...MOCK_ITEM, id: 'other-id' });
    await facade.loadById('other-id');
    expect(facade.data()?.id).toBe('other-id');
  });

  it('loadById() — not found: data es null', async () => {
    repoSpy.findById.mockResolvedValueOnce(null);
    await facade.loadById('nonexistent');
    expect(facade.data()).toBeNull();
  });

  // ── actualizar ────────────────────────────────────────────────────────────

  it('actualizar() — optimistic update: refleja el patch antes de la respuesta', async () => {
    await facade.loadById(MOCK_ITEM.id);
    const patch = { /* TODO: un campo real de {{Domain}}Row */ } as any;
    const promise = facade.actualizar(patch);
    expect(facade.data()).toMatchObject({ ...MOCK_ITEM, ...patch });
    await promise;
  });

  it('actualizar() — rollback si el repo falla', async () => {
    await facade.loadById(MOCK_ITEM.id);
    repoSpy.update.mockRejectedValueOnce(new Error('DB error'));
    await facade.actualizar({ /* TODO */ } as any);
    expect(facade.data()).toEqual(MOCK_ITEM); // rollback
    expect(toastSpy.error).toHaveBeenCalledTimes(1);
  });

  // TODO: agregar tests para métodos adicionales del facade
});
`,

};
