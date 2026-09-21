import { EVENT_BRAND } from '../event-brand';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
  output,
} from '@angular/core';
import { gsap } from 'gsap';
import type { Greeting } from '../dashboard/welcome-queue';

@Component({
  selector: 'app-welcome-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="welcome-overlay" role="status" aria-live="polite">
    <div class="welcome-card">
      <img class="celebration" [src]="brand.logo" [alt]="brand.name" width="248" height="80" />
      <p>A NEW CONNECTION. A NEW POSSIBILITY.</p>
      @if (greeting().count > 1) {
        <h2>{{ greeting().count }} new faces<span>.</span></h2>
        <p class="batch-names">{{ greeting().names.join(' · ') }}</p>
        <div class="subtitle">Welcome to AI EXPO 2026. You belong here.</div>
      } @else {
        <h2>
          Welcome,<br /><span>{{ greeting().names[0] || 'friend' }}.</span>
        </h2>
        <div class="subtitle">The future of AI starts with connections like this.</div>
      }
      <div class="welcome-progress"></div>
    </div>
  </div>`,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 1000;
      pointer-events: none;
    }
    .welcome-overlay {
      height: 100%;
      display: grid;
      place-items: center;
      background: #0b0911f2;
      backdrop-filter: blur(10px);
      padding: 24px;
    }
    .welcome-card {
      text-align: center;
      max-width: 100%;
      position: relative;
      padding: 50px 30px;
    }
    .celebration {
      font-size: 70px;
      color: #b38aff;
    }
    .welcome-card p {
      font-size: 11px;
      letter-spacing: 3px;
      font-weight: 700;
      margin: 28px 0;
    }
    h2 {
      font-size: clamp(52px, 8vw, 120px);
      line-height: 1.1;
      letter-spacing: -4px;
      margin: 0 0 24px;
      overflow-wrap: anywhere;
    }
    h2 span {
      color: #b38aff;
    }
    .batch-names {
      font-size: clamp(12px, 1.4vw, 20px);
      max-width: 1000px;
      max-height: 30vh;
      overflow: auto;
      pointer-events: auto;
      letter-spacing: 0;
      line-height: 1.8;
    }
    .subtitle {
      color: #b5a6c7;
      font-size: 18px;
    }
    .welcome-progress {
      height: 3px;
      background: linear-gradient(90deg, #7a3cff, #2cabe2);
      max-width: 200px;
      margin: 42px auto 0;
      transform-origin: left;
    }
  `,
})
export class WelcomeOverlayComponent {
  protected readonly brand = EVENT_BRAND;
  readonly greeting = input.required<Greeting>();
  readonly finished = output<void>();
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const context = gsap.context(() => {
        gsap
          .timeline({ onComplete: () => this.finished.emit() })
          .from('.welcome-overlay', { opacity: 0, duration: reduced ? 0 : 0.35 })
          .from(
            '.welcome-card',
            { y: reduced ? 0 : 35, opacity: 0, duration: reduced ? 0 : 0.5, ease: 'power3.out' },
            '<',
          )
          .to('.welcome-progress', { scaleX: 0, duration: 3, ease: 'none' })
          .to('.welcome-overlay', { opacity: 0, duration: reduced ? 0 : 0.4 });
      }, this.host.nativeElement);
      this.destroyRef.onDestroy(() => context.revert());
    });
  }
}
