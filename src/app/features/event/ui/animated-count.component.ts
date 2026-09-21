import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  signal,
  untracked,
} from '@angular/core';
import { gsap } from 'gsap';

@Component({
  selector: 'app-animated-count',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  template: '{{ displayed() | number }}',
})
export class AnimatedCountComponent {
  readonly value = input.required<number>();
  protected readonly displayed = signal(0);
  constructor() {
    effect((onCleanup) => {
      const target = this.value();
      const counter = { value: untracked(this.displayed) };
      const tween = gsap.to(counter, {
        value: target,
        duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 0.65,
        ease: 'power2.out',
        onUpdate: () => this.displayed.set(Math.round(counter.value)),
      });
      onCleanup(() => tween.kill());
    });
  }
}
