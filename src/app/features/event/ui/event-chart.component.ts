import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
} from '@angular/core';
import { init, use } from 'echarts/core';
import type { EChartsCoreOption, EChartsType } from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, AriaComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';

use([BarChart, LineChart, PieChart, GridComponent, TooltipComponent, AriaComponent, SVGRenderer]);

@Component({
  selector: 'app-event-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  host: { role: 'img', '[attr.aria-label]': 'label()' },
  styles: ':host { display: block; width: 100%; height: 240px; min-width: 0; }',
})
export class EventChartComponent {
  readonly options = input.required<EChartsCoreOption>();
  readonly label = input.required<string>();
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);
  private chart?: EChartsType;
  constructor() {
    effect(() => this.render(this.options()));
    afterNextRender(() => {
      this.chart = init(this.host.nativeElement, undefined, { renderer: 'svg' });
      this.render(this.options());
      const observer = new ResizeObserver(() => this.chart?.resize());
      observer.observe(this.host.nativeElement);
      this.destroyRef.onDestroy(() => {
        observer.disconnect();
        this.chart?.dispose();
      });
    });
  }
  private render(options: EChartsCoreOption): void {
    this.chart?.setOption(
      {
        ...options,
        animation: !matchMedia('(prefers-reduced-motion: reduce)').matches,
        animationDurationUpdate: 650,
        aria: { enabled: true },
        textStyle: { fontFamily: 'Manrope, sans-serif' },
      },
      { notMerge: true },
    );
  }
}
