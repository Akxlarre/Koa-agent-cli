import { Injectable, computed } from '@angular/core';

/** Item de navegación lateral. `icon` es el nombre kebab-case de Lucide. */
export interface NavItem {
  label: string;
  /** Nombre kebab-case de lucide.dev (ej: 'layout-dashboard', 'settings') */
  icon: string;
  routerLink: string;
}

/**
 * MenuConfigService - Configuración del menú de navegación lateral.
 *
 * Para añadir rutas: agrega un NavItem a la lista.
 * Íconos: usa el nombre kebab-case de lucide.dev.
 * Los íconos deben estar registrados en provideIcons() en app.config.ts.
 */
@Injectable({
  providedIn: 'root',
})
export class MenuConfigService {

  readonly menuItems = computed<NavItem[]>(() => {
    return [
      {
        label: 'Dashboard',
        icon: 'layout-dashboard',
        routerLink: '/app/dashboard',
      },
      // TODO: Añade tus rutas de feature aquí
      // Sólo va en el menú lo que TIENE ruta en app.routes.ts. Este archivo
      // nacía con una entrada a /app/settings que nunca existió: el usuario
      // hacía clic y caía en el not-found. NAV-01 ahora lo bloquea.
      //
      // Para agregar una sección: primero su ruta, después su NavItem.
    ];
  });
}
