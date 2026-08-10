import { Directive, ElementRef, inject, afterNextRender } from '@angular/core';
import { GsapAnimationsService } from '@core/services/gsap-animations.service';

/**
 * BentoRevealDirective — Reveal de entrada sin flash para `.bento-grid`.
 *
 * Su valor está en **acoplar** dos pasos que si viven separados producen parpadeo:
 *
 *   1. PRE-HIDE (constructor, pre-paint): añade `.is-reveal-pending`, que el CSS
 *      traduce a `opacity: 0` en las celdas. El constructor corre durante la
 *      creación de la vista, ANTES del primer paint → las celdas nunca se ven
 *      "encendidas y luego apagadas".
 *   2. REVEAL (afterNextRender): dispara `animateBentoGrid()` y retira la clase,
 *      de modo que la animación arranca desde el estado oculto sin salto.
 *
 * Como el hide y el reveal son del mismo dueño, es imposible dejar celdas
 * huérfanas en `opacity: 0`.
 *
 * Respeta `prefers-reduced-motion` vía `GsapAnimationsService`. Además hay un
 * safety net en `_bento-grid.scss` que fuerza `opacity: 1` bajo reduced-motion
 * aunque el JS tarde o falle.
 *
 * @example
 * <div class="bento-grid" appBentoReveal appBentoGridLayout>...</div>
 */
@Directive({
  selector: '[appBentoReveal]',
  standalone: true,
})
export class BentoRevealDirective {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly gsap = inject(GsapAnimationsService);

  constructor() {
    // Pre-paint: ocultar las celdas antes de que el browser pinte por primera vez.
    this.el.nativeElement.classList.add('is-reveal-pending');

    afterNextRender(() => {
      const host = this.el.nativeElement;
      try {
        this.gsap.animateBentoGrid(host);
      } finally {
        // Siempre retirar el pre-hide: si la animación no corre (reduced-motion,
        // GSAP no disponible, error), dejar las celdas en opacity:0 sería peor
        // que no animar.
        host.classList.remove('is-reveal-pending');
      }
    });
  }
}
