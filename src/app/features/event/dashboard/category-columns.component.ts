import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { rankedBreakdown, type BreakdownRow } from './analytics';

@Component({
  selector: 'app-category-columns',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="columns" aria-label="Checked-in attendees by major category">
      @for (row of visibleRows(); track row.name; let i = $index) {
        <li [style.--color]="colors[i % colors.length]">
          <div class="plot">
            <strong>{{ row.count }}</strong>
            <div class="bar" [style.height.%]="(row.count / maximum()) * 75"></div>
          </div>
          <div class="column-label">{{ row.name }}</div>
          <small>{{ total() ? ((row.count / total()) * 100).toFixed(1) : '0.0' }}%</small>
        </li>
      }
    </ol>
    @if (rows().length > 5) {
      <details>
        <summary>View all {{ rows().length }} categories</summary>
        @for (row of rows(); track row.name) {
          <p>
            {{ row.name }} <strong>{{ row.count }}</strong>
          </p>
        }
      </details>
    }
  `,
  styleUrl: './category-columns.component.scss',
})
export class CategoryColumnsComponent {
  readonly rows = input.required<BreakdownRow[]>();
  readonly total = input.required<number>();
  protected readonly visibleRows = computed(() => rankedBreakdown(this.rows()));
  protected readonly maximum = computed(() =>
    Math.max(1, ...this.visibleRows().map((row) => row.count)),
  );
  protected readonly colors = ['#73ddc5', '#55c8f4', '#b89aff', '#efbe78', '#e697c4'];
}
