import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { rankedBreakdown, type BreakdownRow } from './analytics';

@Component({
  selector: 'app-profile-visual',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (mode() === 'composition') {
      <div class="composition-band" aria-hidden="true">
        @for (row of displayRows(); track row.name; let i = $index) {
          <span [style.flex-grow]="row.count" [style.background]="colors[i % colors.length]"></span>
        }
      </div>
    }
    <ul
      [class.gauges]="mode() === 'coverage'"
      [attr.aria-label]="label()"
      [style.--columns]="displayRows().length || 1"
    >
      @for (row of displayRows(); track row.name; let i = $index) {
        <li [style.--accent]="colors[i % colors.length]">
          @if (mode() === 'coverage') {
            <svg
              viewBox="0 0 80 80"
              role="img"
              [attr.aria-label]="row.name + ': ' + percentage(row.count).toFixed(1) + '% provided'"
            >
              <circle cx="40" cy="40" r="32" class="gauge-track" />
              <circle
                cx="40"
                cy="40"
                r="32"
                class="gauge-fill"
                pathLength="100"
                [attr.stroke-dasharray]="percentage(row.count) + ' 100'"
                transform="rotate(-90 40 40)"
              />
              <text x="40" y="44" text-anchor="middle">
                {{ percentage(row.count).toFixed(0) }}%
              </text>
            </svg>
          }
          <div class="category-value">
            <strong>{{ row.count }}</strong
            ><span>{{ percentage(row.count).toFixed(1) }}%</span>
          </div>
          <div class="category-name">{{ row.name }}</div>
        </li>
      }
    </ul>
    @if (mode() === 'composition' && rows().length > 5) {
      <details>
        <summary>View all {{ rows().length }} groups</summary>
        @for (row of rows(); track row.name) {
          <p>
            {{ row.name }}
            <strong>{{ row.count }} · {{ percentage(row.count).toFixed(1) }}%</strong>
          </p>
        }
      </details>
    }
  `,
  styleUrl: './profile-visual.component.scss',
})
export class ProfileVisualComponent {
  readonly rows = input.required<BreakdownRow[]>();
  readonly total = input.required<number>();
  readonly label = input.required<string>();
  readonly mode = input<'composition' | 'coverage'>('composition');
  protected readonly colors = ['#55c8f4', '#b89aff', '#73ddc5', '#efbe78', '#e697c4'];
  protected readonly displayRows = computed(() =>
    this.mode() === 'coverage' ? this.rows() : rankedBreakdown(this.rows()),
  );
  protected percentage(count: number): number {
    return this.total() ? (count / this.total()) * 100 : 0;
  }
}
