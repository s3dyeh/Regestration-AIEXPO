import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { CohortRow } from '../domain';

@Component({
  selector: 'app-cohort-comparison',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="comparison-key">
      <span>Registered</span><span>Checked in</span><span>Turnout = checked in / registered</span>
    </div>
    <ol class="comparison" aria-label="Registered participants compared with attendance">
      @for (row of visible(); track row.name) {
        <li>
          <div class="comparison-label">
            <span>{{ row.name }}</span
            ><strong
              >{{ row.attended }} / {{ row.registered }} <small>{{ rate(row) }}%</small></strong
            >
          </div>
          <div class="comparison-bar" aria-hidden="true">
            <span class="registered" [style.width.%]="(row.registered / maximum()) * 100"></span
            ><span class="attended" [style.width.%]="(row.attended / maximum()) * 100"></span>
          </div>
        </li>
      }
    </ol>
    @if (rows().length > 3) {
      <button type="button" (click)="expanded.set(!expanded())" [attr.aria-expanded]="expanded()">
        {{ expanded() ? 'Show leading groups' : 'View all ' + rows().length + ' groups' }}
      </button>
    }
  `,
  styleUrl: './cohort-comparison.component.scss',
})
export class CohortComparisonComponent {
  readonly rows = input.required<CohortRow[]>();
  protected readonly expanded = signal(false);
  protected readonly sorted = computed(() =>
    [...this.rows()].sort((a, b) => b.registered - a.registered || a.name.localeCompare(b.name)),
  );
  protected readonly visible = computed(() =>
    this.expanded() ? this.sorted() : this.sorted().slice(0, 3),
  );
  protected readonly maximum = computed(() =>
    Math.max(1, ...this.rows().map((row) => row.registered)),
  );
  protected rate(row: CohortRow): string {
    return (row.registered ? (row.attended / row.registered) * 100 : 0).toFixed(1);
  }
}
