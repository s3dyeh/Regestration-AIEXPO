import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { careerFocuses } from './career-path';
import type { buildCareerPlan } from './career-path';
@Component({
  selector: 'app-career-path',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './career-path.component.scss',
  template: `
    <section class="path-planner" aria-label="Personal career path">
      <header>
        <p class="eyebrow">YOUR FOCUS · YOUR NEXT STEP</p>
        <h3>Build your career path.</h3>
        <p>
          Choose your direction. We order practical milestones using your GitHub evidence and
          prerequisites.
        </p>
      </header>
      <label for="career-focus">Focus path</label>
      <select id="career-focus" [value]="plan().focus.id" (change)="choose($event)">
        @for (focus of focuses; track focus.id) {
          <option [value]="focus.id">{{ focus.name }}</option>
        }
      </select>
      <div class="path-summary" role="status">
        <strong>{{ plan().focus.name }}</strong>
        <span>{{ plan().completed }} / {{ plan().steps.length }} milestones self-validated</span>
      </div>
      <progress
        [value]="plan().completed"
        [max]="plan().steps.length"
        aria-label="Self-validated career milestones"
      ></progress>
      <p>
        <a [href]="plan().focus.roadmap" target="_blank" rel="noopener noreferrer"
          >Explore the {{ plan().focus.name }} roadmap on roadmap.sh ↗</a
        >
      </p>
      <p class="note">
        Independent CareerLens plan with links to roadmap.sh. Related GitHub evidence is not proof
        of mastery. Check a milestone only after demonstrating its deliverable. Your checklist
        resets when changing focus or analyzing a profile; download the report to keep it.
      </p>
      <details>
        <summary>How is this plan ordered?</summary>
        <p>
          Algorithm v{{ plan().version }} expands your chosen focus into a prerequisite graph.
          Prerequisites always come first. Among eligible milestones, observed gaps come before
          unknown evidence, then observed indicators; ties use stable milestone IDs. Counts of
          repeated technologies never increase priority. A prerequisite is satisfied only by your
          explicit self-validation, not by a repository score.
        </p>
        <p>
          Unchecking a prerequisite also clears dependent milestones. There is no hiring-readiness
          score, completion-time promise, AI generation or automatic career choice. Links were
          checked on October 1, 2026.
        </p>
      </details>
      <aside class="next-step">
        <h4>Start or continue here</h4>
        @for (step of plan().next; track step.id) {
          <p>
            <strong>{{ step.title }}</strong> — {{ step.deliverable }}
          </p>
        } @empty {
          <p>
            All planned milestones are self-validated. Ask someone to review your capstone against
            the deliverables.
          </p>
        }
      </aside>
      <ol class="milestones">
        @for (step of plan().steps; track step.id; let index = $index) {
          <li [class.done]="step.completed">
            <div class="step-heading">
              <h4>{{ index + 1 }}. {{ step.title }}</h4>
              <span class="status" [attr.data-status]="step.status">{{
                step.status === 'observed'
                  ? 'Related evidence'
                  : step.status === 'needs-work'
                    ? 'Observed gap'
                    : 'Needs verification'
              }}</span>
            </div>
            <p>{{ step.deliverable }}</p>
            @if (step.blockedBy.length) {
              <p class="blocked">Validate first: {{ prerequisiteTitles(step.blockedBy) }}</p>
            }
            <details>
              <summary>Why this milestone?</summary>
              <p>{{ step.reason }}</p>
              <ul>
                @for (evidence of step.evidence; track $index) {
                  <li>
                    <a [href]="evidence.url" target="_blank" rel="noopener noreferrer"
                      >{{ evidence.label }} ↗</a
                    >
                  </li>
                }
              </ul>
            </details>
            <div class="step-actions">
              <a [href]="step.roadmap" target="_blank" rel="noopener noreferrer"
                >Learning roadmap ↗</a
              >
              <label
                ><input
                  type="checkbox"
                  [checked]="step.completed"
                  [disabled]="step.blockedBy.length > 0"
                  (change)="validate(step.id, $event)"
                  [attr.aria-label]="'Validate ' + step.title"
                />
                I demonstrated this</label
              >
            </div>
          </li>
        }
      </ol>
      <aside class="capstone">
        <h4>Your focus project</h4>
        <p>{{ plan().focus.project }}</p>
        <p>
          Include a reproducible demo, tests, evidence of failure handling and a short explanation
          of tradeoffs. Request human review before treating this as career readiness.
        </p>
      </aside>
    </section>
  `,
})
export class CareerPathComponent {
  readonly plan = input.required<ReturnType<typeof buildCareerPlan>>();
  readonly focusChange = output<string>();
  readonly milestoneChange = output<{ id: string; done: boolean }>();
  protected readonly focuses = careerFocuses;
  protected choose(event: Event): void {
    this.focusChange.emit((event.target as HTMLSelectElement).value);
  }
  protected validate(id: string, event: Event): void {
    this.milestoneChange.emit({ id, done: (event.target as HTMLInputElement).checked });
  }
  protected prerequisiteTitles(ids: string[]): string {
    return ids
      .map((id) => this.plan().steps.find((step) => step.id === id)?.title ?? id)
      .join(', ');
  }
}
