import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { EventStats } from '../domain';
import { AnimatedCountComponent } from '../ui/animated-count.component';
import { representedCount } from './analytics';
@Component({
  selector: 'app-event-metrics',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AnimatedCountComponent],
  templateUrl: './event-metrics.component.html',
  styleUrl: './event-metrics.component.scss',
})
export class EventMetricsComponent {
  readonly stats = input.required<EventStats>();
  protected memberRatio(): string {
    return this.stats().total
      ? ((this.stats().ieeeMembers / this.stats().total) * 100).toFixed(1)
      : '0.0';
  }
  protected groups(dimension: 'universities') {
    return this.stats().audience.dimensions[dimension].map((row) => ({
      name: row.name,
      count: row.attended,
    }));
  }
  protected readonly representedCount = representedCount;
}
