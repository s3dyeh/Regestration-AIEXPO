import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { BreakdownRow } from './analytics';

@Component({
  selector: 'app-distribution-donut',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="distribution">
      <svg viewBox="0 0 110 110" role="img" [attr.aria-label]="description()">
        <circle
          cx="55"
          cy="55"
          r="51"
          fill="none"
          stroke="#b89aff22"
          stroke-width="0.5"
          stroke-dasharray="1 4"
        />
        <circle cx="55" cy="55" r="33" fill="#ffffff03" stroke="#ffffff08" stroke-width="0.5" />
        <circle cx="55" cy="55" r="42" fill="none" stroke="#ffffff12" stroke-width="10" />
        @for (slice of slices(); track slice.name) {
          <circle
            cx="55"
            cy="55"
            r="42"
            fill="none"
            [attr.stroke]="slice.color"
            stroke-width="10"
            pathLength="100"
            [attr.stroke-dasharray]="slice.share + ' ' + (100 - slice.share)"
            [attr.stroke-dashoffset]="-slice.offset"
            transform="rotate(-90 55 55)"
          />
        }
        <text x="55" y="54" text-anchor="middle" class="donut-value">{{ total() }}</text>
        <text x="55" y="65" text-anchor="middle" class="donut-caption">{{ caption() }}</text>
      </svg>
      <ul>
        @for (slice of slices(); track slice.name) {
          <li>
            <span class="swatch" [style.background]="slice.color" aria-hidden="true"></span
            ><span
              >{{ slice.name }}<small>{{ slice.share.toFixed(1) }}%</small></span
            ><strong>{{ slice.count }}</strong>
          </li>
        }
      </ul>
    </div>
  `,
  styleUrl: './distribution-donut.component.scss',
})
export class DistributionDonutComponent {
  readonly rows = input.required<BreakdownRow[]>();
  readonly caption = input('PEOPLE');
  protected readonly total = computed(() => this.rows().reduce((sum, row) => sum + row.count, 0));
  protected readonly slices = computed(() => {
    let offset = 0;
    const colors = ['#2cabe2', '#ad86ff', '#c3b6d3', '#69d8bf', '#edb96c'];
    return this.rows().map((row, index) => {
      const share = this.total() ? (row.count / this.total()) * 100 : 0;
      const slice = { ...row, share, offset, color: colors[index % colors.length] };
      offset += share;
      return slice;
    });
  });
  protected readonly description = computed(() =>
    this.rows()
      .map((row) => `${row.name}: ${row.count}`)
      .join(', '),
  );
}
