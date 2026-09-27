import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
} from '@angular/core';
import { Fireworks } from 'fireworks-js';
import { gsap } from 'gsap';

/** A finite, decorative celebration; it never controls the greeting's lifetime. */
@Component({
  selector: 'app-greeting-fireworks',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <div class="corner top left"></div>
    <div class="corner top right"></div>
    <div class="corner bottom left"></div>
    <div class="corner bottom right"></div>
  `,
  styles: `
    :host {
      position: absolute;
      inset: 0;
      overflow: hidden;
      pointer-events: none;
    }
    .corner {
      position: absolute;
      width: min(30vw, 440px);
      height: min(40vh, 350px);
      opacity: 0.85;
      mask-image: radial-gradient(ellipse at center, #000 35%, transparent 75%);
    }
    .top {
      top: 0;
    }
    .bottom {
      bottom: 0;
    }
    .left {
      left: 0;
    }
    .right {
      right: 0;
    }
    @media (max-width: 600px) {
      .corner {
        width: 42vw;
        height: 25vh;
        opacity: 0.65;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      :host {
        display: none;
      }
    }
  `,
})
export class GreetingFireworksComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      const motion = matchMedia('(prefers-reduced-motion: reduce)');
      if (motion.matches || document.hidden) return;

      const compact = matchMedia('(max-width: 600px)').matches;
      const bursts = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('.corner'));
      const effects = bursts.map(
        (corner, index) =>
          new Fireworks(corner, {
            hue: index % 2 ? { min: 195, max: 205 } : { min: 260, max: 275 },
            particles: compact ? 22 : 42,
            explosion: compact ? 3 : 4,
            traceLength: 2,
            traceSpeed: 6,
            acceleration: 1.04,
            friction: 0.96,
            gravity: 0.7,
            flickering: 0,
            opacity: 0.22,
            brightness: { min: 65, max: 80 },
            decay: { min: 0.022, max: 0.032 },
            lineWidth: { explosion: { min: 1, max: 1.5 }, trace: { min: 1, max: 1.2 } },
            rocketsPoint: { min: 48, max: 52 },
            boundaries: { x: corner.clientWidth * 0.3, y: corner.clientHeight * 0.42 },
            mouse: { click: false, move: false },
            sound: { enabled: false },
          }),
      );
      const sequence = gsap.timeline();
      effects.forEach((effect, index) => {
        sequence.call(() => effect.launch(1), [], index < 2 ? 0.15 : 0.55);
      });
      const stop = () => {
        sequence.kill();
        effects.forEach((effect) => effect.stop(true));
        bursts.forEach((corner) => corner.replaceChildren());
      };
      sequence.call(stop, [], 2.9);
      const onMotion = () => {
        if (motion.matches) stop();
      };
      const onVisibility = () => {
        if (document.hidden) stop();
      };
      motion.addEventListener('change', onMotion);
      document.addEventListener('visibilitychange', onVisibility);
      this.destroyRef.onDestroy(() => {
        stop();
        motion.removeEventListener('change', onMotion);
        document.removeEventListener('visibilitychange', onVisibility);
      });
    });
  }
}
