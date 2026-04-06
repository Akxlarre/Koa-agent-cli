---
paths:
  - "src/app/core/**/*.ts"
  - "src/app/features/**/*.ts"
---

# State Management — Cuándo usar qué

## Facade (default — siempre disponible)

Usar cuando:
- El estado pertenece a **UN solo dominio/feature**
- Máximo 3-4 signals por facade
- No hay estado compartido entre features
- La lógica es CRUD simple

```typescript
@Injectable({ providedIn: 'root' })
export class ProductsFacade {
  private svc = inject(ProductsService);

  readonly items = toSignal(this.svc.products$, { initialValue: [] });
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
}
```

## Signal Store (requiere `blueprint.ngrxSignals: true`)

Usar cuando:
- Estado compartido entre **2+ features**
- Más de 5 signals con derived state complejo
- Necesitas `patchState()` para updates parciales atómicos
- Múltiples `computed()` que dependen del mismo estado
- El feature tiene más de 3 actions/methods

```typescript
// core/state/{domain}.store.ts
export const ExampleStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    filteredItems: computed(() => store.items().filter(/* ... */)),
  })),
  withMethods((store, svc = inject(ExampleService)) => ({
    async load(): Promise<void> {
      patchState(store, { isLoading: true });
      // ...
    },
  }))
);
```

## Regla de escalamiento

1. Empieza con **Facade**
2. Si el Facade crece a >5 `inject()` o >8 signals → migra a **Signal Store**
3. **NUNCA** mezclar Facade + Signal Store para el MISMO dominio
4. Signal Stores deben vivir en `core/state/` (no en `features/` ni `shared/`)

## Ubicación de archivos

| Patrón | Ruta canónica |
|--------|---------------|
| Facade | `core/services/{domain}.facade.ts` |
| Signal Store | `core/state/{domain}.store.ts` |
| Service (data) | `core/services/{domain}.service.ts` |

## Inyección en componentes

- Smart Components (`features/`) pueden inyectar tanto Facades como Signal Stores
- **NUNCA** exponer `patchState` al template — solo métodos del store
- Dumb Components (`shared/`) nunca inyectan — solo `input()` / `output()`
