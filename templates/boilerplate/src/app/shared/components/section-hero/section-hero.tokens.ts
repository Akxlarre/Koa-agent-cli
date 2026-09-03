import { getSparklinePoints } from '@core/utils/sparkline.utils';
import type { SectionHeroChip, SectionHeroKpi } from '@core/models/section-hero.model';

/**
 * Mapeos de un dato del hero a un token del design system.
 *
 * Todas son funciones puras: no tocan `this`, no leen el DOM, no dependen del
 * ciclo de vida. Vivían dentro de `SectionHeroComponent` y eran la mitad de su
 * cuerpo (`INC-008`: 258 líneas contra el límite de 200 de `ARCH-09`), que es
 * exactamente lo que el fix de esa regla dice hacer — «extrae lógica a
 * servicios/utilidades».
 *
 * El componente conserva un método de una línea por cada una porque un template
 * de Angular solo puede llamar miembros de la clase. Eso es andamiaje; la
 * decisión de qué token corresponde a qué estado vive acá, y se testea sin
 * montar un componente.
 */

export type ChipVariant = 'neutral' | 'warning' | 'error' | 'success';

/** El chip del hero es un badge de estado: se delega en BadgeComponent (ARCH-15). */
export function chipVariant(chip: SectionHeroChip): ChipVariant {
  switch (chip.style) {
    case 'warning':
      return 'warning';
    case 'error':
      return 'error';
    case 'success':
      return 'success';
    default:
      return 'neutral';
  }
}

/** Verde si sube, rojo si baja. El signo se muestra aparte (ver `trendDisplay`). */
export function trendColor(trend: number): string {
  return trend > 0 ? 'var(--state-success)' : 'var(--state-error)';
}

/** El valor sin signo: la dirección la comunica el color y el ícono, no un «-». */
export function trendDisplay(trend: number): string {
  return String(Math.abs(trend));
}

/** El color explícito del KPI gana; si no hay, lo decide la tendencia. */
export function sparklineColor(kpi: SectionHeroKpi): string {
  if (kpi.color === 'success' || (kpi.trend !== undefined && kpi.trend > 0))
    return 'var(--state-success)';
  if (kpi.color === 'error' || (kpi.trend !== undefined && kpi.trend < 0))
    return 'var(--state-error)';
  if (kpi.color === 'warning') return 'var(--state-warning)';
  return 'var(--ds-brand)';
}

export function kpiValueColor(kpi: SectionHeroKpi): string {
  switch (kpi.color) {
    case 'success':
      return 'var(--state-success)';
    case 'error':
      return 'var(--state-error)';
    case 'warning':
      return 'var(--state-warning)';
    default:
      return 'var(--text-primary)';
  }
}

/**
 * El tinte de fondo del KPI. Un KPI en cero no se tinta aunque tenga color:
 * «0 errores» no es una alerta.
 */
export function kpiBgTint(kpi: SectionHeroKpi): string {
  if (!(+kpi.value > 0)) return 'transparent';
  switch (kpi.color) {
    case 'error':
      return 'var(--state-error-bg)';
    case 'warning':
      return 'var(--state-warning-bg)';
    case 'success':
      return 'var(--state-success-bg)';
    default:
      return 'transparent';
  }
}

export { getSparklinePoints };
