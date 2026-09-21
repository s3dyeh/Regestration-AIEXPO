import { afterNextRender, DestroyRef, Directive, ElementRef, inject } from '@angular/core';
import { gsap } from 'gsap';

/** Shared entry choreography with automatic teardown; content stays visible without motion. */
@Directive({ selector: '[appReveal]' })
export class RevealDirective {
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  constructor() {
    afterNextRender(() => {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const context = gsap.context(() => {
        const targets = this.host.nativeElement.querySelectorAll('[data-reveal]');
        gsap.from(targets.length ? targets : this.host.nativeElement, {
          opacity: 0,
          y: 22,
          duration: 0.8,
          stagger: 0.08,
          ease: 'power3.out',
          clearProps: 'transform,opacity',
        });
      }, this.host.nativeElement);
      this.destroyRef.onDestroy(() => context.revert());
    });
  }
}
