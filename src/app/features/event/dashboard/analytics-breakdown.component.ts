import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { rankedBreakdown, type BreakdownRow } from './analytics';
@Component({
  selector: 'app-analytics-breakdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ranking-head" aria-hidden="true">
      <span>University</span><span>Here</span><span>Share</span>
    </div>
    <ol class="university-ranking" [attr.aria-label]="label()">
      @for (row of visibleRows(); track row.name; let i = $index) {
        <li [class.remaining]="row.name.startsWith('Remaining ')">
          <span class="rank" aria-hidden="true">{{
            row.name.startsWith('Remaining ') ? '+' : (i + 1).toString().padStart(2, '0')
          }}</span>
          <div class="university-measure">
            <span class="university-name" [title]="row.name">{{ row.name }}</span>
            <div class="university-track" aria-hidden="true">
              <span
                [style.transform]="'scaleX(' + (total() ? row.count / total() : 0) + ')'"
              ></span>
            </div>
          </div>
          <strong>{{ row.count }}</strong
          ><span class="university-share">{{ share(row.count) }}%</span>
        </li>
      }
    </ol>
    <details class="university-details">
      <summary>View full university list <span aria-hidden="true">&#8599;</span></summary>
      <ul>
        @for (row of sortedRows(); track row.name) {
          <li>
            <span>{{ row.name }}</span
            ><strong>{{ row.count }} · {{ share(row.count) }}%</strong>
          </li>
        }
      </ul>
    </details>
  `,
  styleUrl: './analytics-breakdown.component.scss',
})
export class AnalyticsBreakdownComponent {
  readonly rows = input.required<BreakdownRow[]>();
  readonly total = input.required<number>();
  readonly label = input.required<string>();
  protected readonly sortedRows = computed(() =>
    [...this.rows()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  );
  protected readonly visibleRows = computed(() => rankedBreakdown(this.rows()));
  protected share(count: number): string {
    return (this.total() ? (count / this.total()) * 100 : 0).toFixed(1);
  }
}
