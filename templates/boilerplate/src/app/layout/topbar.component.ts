import { Component, ChangeDetectionStrategy, inject } from "@angular/core";

import { AuthFacade } from "@core/services/auth.facade";
import { LayoutService } from "@core/services/layout.service";
import { NotificationsService } from "@core/services/notifications.service";
import { ThemeService } from "@core/services/theme.service";
import { Button } from "primeng/button";
import { Avatar } from "primeng/avatar";
import { BadgeModule } from "primeng/badge";

/**
 * TopbarComponent — barra superior de la aplicación.
 *
 * Smart component: inyecta LayoutService, AuthFacade, NotificationsService, ThemeService.
 *
 * TODOs para extender:
 * - Conectar BreadcrumbService para mostrar la ruta activa
 * - Añadir overlay/panel de notificaciones al pulsar el botón de campana
 * - Añadir menú de usuario (p-menu) al pulsar el avatar
 */
@Component({
  selector: "app-topbar",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, Avatar, BadgeModule],
  template: `
    <header
      class="sticky top-0 z-10 flex h-[56px] items-center gap-4 border-b border-border-subtle bg-surface px-6 shadow-[var(--shadow-layout-topbar)]"
      role="banner"
    >
      <!-- Hamburger — solo visible en mobile -->
      <p-button
        class="!flex lg:!hidden"
        [text]="true"
        [rounded]="true"
        severity="secondary"
        icon="pi pi-bars"
        ariaLabel="Abrir menú de navegación"
        data-llm-action="toggle-mobile-sidebar"
        (onClick)="layout.toggleSidebar()"
      />

      <!-- Título de sección / breadcrumb -->
      <div
        class="flex-1 text-sm font-medium text-text-secondary"
        aria-label="Sección actual"
      >
        <!-- TODO: conectar BreadcrumbService o título de la ruta activa -->
      </div>

      <!-- Acciones de la derecha -->
      <div
        class="flex items-center gap-1"
        role="toolbar"
        aria-label="Acciones globales"
      >
        <!-- Notificaciones -->
        <div
          class="relative"
          [attr.aria-label]="
            'Notificaciones (' + notifications.unreadCount() + ' sin leer)'
          "
        >
          <p-button
            [text]="true"
            [rounded]="true"
            severity="secondary"
            icon="pi pi-bell"
            ariaLabel="Ver notificaciones"
            data-llm-action="open-notifications-panel"
          />
          @if (notifications.unreadCount() > 0) {
            <span
              class="badge-count absolute right-1 top-1"
              aria-hidden="true"
            >
              {{ notifications.unreadCount() }}
            </span>
          }
        </div>

        <!-- Avatar de usuario -->
        @if (auth.currentUser(); as user) {
          <p-button
            [text]="true"
            [rounded]="true"
            severity="secondary"
            [ariaLabel]="'Perfil de ' + user.name"
            data-llm-action="open-user-profile-menu"
          >
            <p-avatar [label]="user.initials" shape="circle" size="normal" />
          </p-button>
        }
      </div>
    </header>
  `,
  styles: [],
})
export class TopbarComponent {
  protected readonly layout = inject(LayoutService);
  protected readonly auth = inject(AuthFacade);
  protected readonly notifications = inject(NotificationsService);
  protected readonly theme = inject(ThemeService);
}
