import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import type { WelcomeEvent } from '../domain';
@Component({
  selector: 'app-recent-arrivals',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink],
  templateUrl: './recent-arrivals.component.html',
  styleUrl: './recent-arrivals.component.scss',
})
export class RecentArrivalsComponent {
  readonly arrivals = input.required<WelcomeEvent[]>();
  protected readonly latestArrivals = computed(() => this.arrivals().slice(0, 3));
}
