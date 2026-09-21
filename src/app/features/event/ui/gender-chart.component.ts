import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { EventStats } from '../domain';
import { EventChartComponent } from './event-chart.component';
import { CHART_COLORS, genderChart } from '../dashboard/chart-options';
@Component({
  selector: 'app-gender-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EventChartComponent],
  template: `
    <div class="gender-content">
      <div class="donut">
        <app-event-chart
          [options]="genderOptions()"
          label="Gender distribution of registered participants"
        /><strong>{{ stats().total }}<small>PARTICIPANTS</small></strong>
      </div>
      <ul>
        @for (item of stats().genders; track item.name; let index = $index) {
          <li>
            <span class="legend-color" [style.background]="colors[index]"></span
            ><span
              >{{ item.name
              }}<small class="legend-share"
                >{{ stats().total ? ((100 * item.count) / stats().total).toFixed(0) : 0 }}% of
                attendees</small
              ></span
            ><strong>{{ item.count }}</strong>
          </li>
        }
      </ul>
    </div>
  `,
  styleUrl: './gender-chart.component.scss',
})
export class GenderChartComponent {
  readonly stats = input.required<EventStats>();
  protected readonly genderOptions = computed(() => genderChart(this.stats()));
  protected readonly colors = CHART_COLORS;
}
