import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { EventStats } from '../domain';
import { AnimatedCountComponent } from '../ui/animated-count.component';
@Component({
  selector: 'app-event-metrics',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AnimatedCountComponent],
  templateUrl: './event-metrics.component.html',
  styleUrl: './event-metrics.component.scss',
})
export class EventMetricsComponent {
  readonly stats = input.required<EventStats>();
}
