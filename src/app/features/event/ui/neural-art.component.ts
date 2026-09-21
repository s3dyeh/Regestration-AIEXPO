import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
} from '@angular/core';

/** Lightweight generative event artwork. Pauses offscreen, in background tabs and for reduced motion. */
@Component({
  selector: 'app-neural-art',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template:
    '<canvas aria-hidden="true"></canvas><div class="art-label"><span>HUMAN CURIOSITY</span><span>×</span><span>ARTIFICIAL INTELLIGENCE</span></div>',
  styles:
    ':host{display:block;position:relative;height:290px;overflow:hidden}canvas{width:100%;height:100%;display:block}.art-label{position:absolute;bottom:0;inset-inline:12px;display:flex;justify-content:space-between;gap:12px;color:#a29cb5;font-size:8px;letter-spacing:1.8px} @media(max-width:760px){:host{height:190px}.art-label{font-size:6px;letter-spacing:1px}}',
})
export class NeuralArtComponent {
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  constructor() {
    afterNextRender(() => {
      const canvas = this.host.nativeElement.querySelector('canvas')!;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const media = matchMedia('(prefers-reduced-motion: reduce)');
      let frame = 0,
        angle = 0.4,
        visible = true,
        last = 0;
      const draw = () => {
        const width = canvas.clientWidth,
          height = canvas.clientHeight;
        const dpr = Math.min(devicePixelRatio || 1, 2);
        if (
          canvas.width !== Math.round(width * dpr) ||
          canvas.height !== Math.round(height * dpr)
        ) {
          canvas.width = Math.round(width * dpr);
          canvas.height = Math.round(height * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);
        const points: { x: number; y: number; z: number; t: number }[] = [];
        const scale = Math.min(width / 4.5, height / 2.8);
        for (let ring = 0; ring < 48; ring++)
          for (let dot = 0; dot < 18; dot++) {
            const u = (ring / 48) * Math.PI * 2,
              v = (dot / 18) * Math.PI * 2;
            const r = 1 + 0.38 * Math.cos(v),
              x = r * Math.cos(u),
              y = r * Math.sin(u),
              z = 0.38 * Math.sin(v);
            const rx = x * Math.cos(angle) - z * Math.sin(angle),
              rz = x * Math.sin(angle) + z * Math.cos(angle);
            points.push({
              x: width / 2 + rx * scale,
              y: height / 2 + (y * 0.55 - rz * 0.72) * scale - 8,
              z: y * 0.72 + rz * 0.55,
              t: ring / 48,
            });
          }
        points
          .sort((a, b) => a.z - b.z)
          .forEach((p) => {
            const depth = (p.z + 1.6) / 3.2;
            ctx.globalAlpha = 0.18 + depth * 0.82;
            ctx.fillStyle = p.t > 0.52 ? '#2cabe2' : '#9766ff';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 0.65 + depth * 1.8, 0, Math.PI * 2);
            ctx.fill();
          });
        ctx.globalAlpha = 1;
      };
      const tick = (time: number) => {
        if (time - last > 32) {
          angle += 0.004;
          draw();
          last = time;
        }
        frame = requestAnimationFrame(tick);
      };
      const sync = () => {
        cancelAnimationFrame(frame);
        draw();
        if (visible && !document.hidden && !media.matches) frame = requestAnimationFrame(tick);
      };
      const observer = new ResizeObserver(sync);
      observer.observe(canvas);
      const intersection = new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting;
        sync();
      });
      intersection.observe(canvas);
      document.addEventListener('visibilitychange', sync);
      media.addEventListener('change', sync);
      sync();
      this.destroyRef.onDestroy(() => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        intersection.disconnect();
        document.removeEventListener('visibilitychange', sync);
        media.removeEventListener('change', sync);
      });
    });
  }
}
