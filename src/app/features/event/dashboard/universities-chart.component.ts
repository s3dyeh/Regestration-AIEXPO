import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { BreakdownRow } from './analytics';

/** Keep three named universities; preserve every attendee in the remainder. */
export function universityOverview(rows: BreakdownRow[]): BreakdownRow[] {
  const known = rows
    .filter(
      (row) =>
        row.count > 0 &&
        !['', 'not provided', 'unknown', 'n/a'].includes(row.name.trim().toLowerCase()),
    )
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const leaders = known.slice(0, 3);
  const remaining =
    rows.reduce((sum, row) => sum + row.count, 0) -
    leaders.reduce((sum, row) => sum + row.count, 0);
  return remaining > 0 ? [...leaders, { name: 'Others', count: remaining }] : leaders;
}

@Component({
  selector: 'app-universities-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="university-overview">
      <svg viewBox="0 0 200 200" role="img" [attr.aria-label]="description()">
        <circle cx="100" cy="100" r="72" fill="none" stroke="#ffffff0b" stroke-width="25" />
        @for (slice of slices(); track slice.name) {
          <path [attr.d]="slice.path" [attr.stroke]="slice.color" fill="none" stroke-width="25" />
        }
        <text x="100" y="104" text-anchor="middle" class="donut-count">{{ total() }}</text>
        <text x="100" y="124" text-anchor="middle" class="donut-caption">CHECKED IN</text>
      </svg>
      <ol aria-label="Leading universities by attendance">
        @for (row of slices(); track row.name) {
          <li [class.other]="row.name === 'Others'">
            <span class="marker" [style.background]="row.color" aria-hidden="true"></span>
            <div class="university-label">
              <span class="name">{{ row.name }}</span>
            </div>
            <div class="university-value">
              <strong>{{ row.count }}</strong
              ><span>{{ share(row.count) }}%</span>
            </div>
          </li>
        }
      </ol>
    </div>
  `,
  styleUrl: './universities-chart.component.scss',
})
export class UniversitiesChartComponent {
  readonly rows = input.required<BreakdownRow[]>();
  readonly total = input.required<number>();
  protected readonly overview = computed(() => universityOverview(this.rows()));
  protected readonly description = computed(() =>
    this.overview()
      .map((row) => `${row.name}: ${row.count} attendees, ${this.share(row.count)}%`)
      .join('; '),
  );
  protected readonly slices = computed(() => {
    let offset = 0;
    const colors = ['#73ddc5', '#55c8f4', '#b89aff', '#655b78'];
    return this.overview().map((row, index) => {
      const fraction = this.total() ? row.count / this.total() : 0;
      const start = offset * Math.PI * 2 - Math.PI / 2;
      offset += fraction;
      const end = offset * Math.PI * 2 - Math.PI / 2;
      const point = (angle: number) =>
        `${100 + 72 * Math.cos(angle)} ${100 + 72 * Math.sin(angle)}`;
      const path =
        fraction >= 0.999999
          ? 'M 100 28 A 72 72 0 1 1 100 172 A 72 72 0 1 1 100 28'
          : `M ${point(start)} A 72 72 0 ${fraction > 0.5 ? 1 : 0} 1 ${point(end)}`;
      return { ...row, path, color: row.name === 'Others' ? colors[3] : colors[index] };
    });
  });
  protected share(count: number): string {
    return (this.total() ? (count / this.total()) * 100 : 0).toFixed(1);
  }
}
