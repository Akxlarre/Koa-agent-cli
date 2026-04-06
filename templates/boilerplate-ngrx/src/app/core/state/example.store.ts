import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { computed, inject } from '@angular/core';
import { SupabaseService } from '../services/supabase.service';

// ─── State shape ─────────────────────────────────────────────────────────────

interface ExampleItem {
  id: string;
  name: string;
}

interface ExampleState {
  items: ExampleItem[];
  isLoading: boolean;
  error: string | null;
  filter: string;
}

const initialState: ExampleState = {
  items: [],
  isLoading: false,
  error: null,
  filter: '',
};

// ─── Signal Store ─────────────────────────────────────────────────────────────
// Use when: state is shared between 2+ features OR >5 signals with complex derived state.
// For simple single-domain state, prefer a Facade in core/services/*.facade.ts

export const ExampleStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withComputed((store) => ({
    filteredItems: computed(() =>
      store.items().filter((item) =>
        item.name.toLowerCase().includes(store.filter().toLowerCase()),
      ),
    ),
    itemCount: computed(() => store.items().length),
    isEmpty: computed(() => store.items().length === 0 && !store.isLoading()),
  })),

  withMethods((store, supabase = inject(SupabaseService)) => ({
    async loadItems(): Promise<void> {
      patchState(store, { isLoading: true, error: null });
      try {
        const { data, error } = await supabase.client
          .from('items')
          .select('*');
        if (error) throw error;
        patchState(store, { items: data ?? [], isLoading: false });
      } catch (err) {
        patchState(store, {
          error: err instanceof Error ? err.message : String(err),
          isLoading: false,
        });
      }
    },

    setFilter(filter: string): void {
      patchState(store, { filter });
    },

    clearError(): void {
      patchState(store, { error: null });
    },
  })),
);
