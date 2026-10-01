import { TranslocoPipe } from '@jsverse/transloco';
import { ChangeDetectionStrategy, Component, inject, linkedSignal, output } from '@angular/core';
import { GitLearningStore } from '../state/git-learning.store';

@Component({
  selector: 'app-learning-coach',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="learning-coach" [attr.aria-label]="'learning_coach.learningCoach' | transloco">
      <div class="coach-progress">
        <span
          >{{ 'learning_coach.courseProgress' | transloco
          }}<strong>{{ store.progress().percent }}%</strong></span
        >
        <progress
          [attr.aria-label]="'learning_coach.completedExperiments' | transloco"
          [value]="store.progress().completed"
          [max]="store.progress().total"
        ></progress>
        <small>{{
          'learning_coach.ofExperimentsCompleted'
            | transloco: { p0: store.progress().completed, p1: store.progress().total }
        }}</small>
      </div>
      @if (!store.final()) {
        <div class="coach-next">
          <small>{{
            store.complete()
              ? ('learning_coach.readyToContinue' | transloco)
              : ('learning_coach.nextGoal' | transloco)
          }}</small>
          <p>
            {{
              store.nextGoal() ?? 'learning_coach.youCompletedThisExperimentSGoalsContinue'
                | transloco
            }}
          </p>
          <div class="coach-actions">
            <button type="button" (click)="navigate.emit('command-input')">
              {{ 'learning_coach.goToTerminal' | transloco }}
            </button>
            @if (store.showEditor()) {
              <button type="button" (click)="navigate.emit('file-content')">
                {{ 'learning_coach.goToEditor' | transloco }}
              </button>
            }
            <button
              type="button"
              [attr.aria-expanded]="hintOpen()"
              aria-controls="challenge-hint"
              (click)="hintOpen.update(toggle)"
            >
              {{
                hintOpen()
                  ? ('learning_coach.hideHint' | transloco)
                  : ('learning_coach.iNeedAHint' | transloco)
              }}
            </button>
          </div>
          @if (hintOpen()) {
            <div id="challenge-hint" class="coach-hint">
              <strong>{{ 'learning_coach.thinkBeforeRunning' | transloco }}</strong>
              <p>{{ store.challenge().hint | transloco }}</p>
              <small>{{ 'learning_coach.hintsOnlyExplainSolvePerformsOneStep' | transloco }}</small>
            </div>
          }
        </div>
      }
      <dl
        class="repository-summary"
        [attr.aria-label]="'learning_coach.repositoryState' | transloco"
      >
        <div>
          <dt>{{ 'learning_coach.currentBranch' | transloco }}</dt>
          <dd dir="ltr">{{ store.repositorySummary().branch }}</dd>
        </div>
        <div>
          <dt>{{ 'learning_coach.unsavedDrafts' | transloco }}</dt>
          <dd data-summary="drafts">{{ store.repositorySummary().drafts }}</dd>
        </div>
        <div>
          <dt>{{ 'learning_coach.unstagedFiles' | transloco }}</dt>
          <dd data-summary="unstaged">{{ store.repositorySummary().unstaged }}</dd>
        </div>
        <div>
          <dt>{{ 'learning_coach.stagedFiles' | transloco }}</dt>
          <dd data-summary="staged">{{ store.repositorySummary().staged }}</dd>
        </div>
        <div>
          <dt>{{ 'learning_coach.commitObjects' | transloco }}</dt>
          <dd data-summary="commits">{{ store.repositorySummary().commits }}</dd>
        </div>
      </dl>
    </section>
  `,
})
export class LearningCoachComponent {
  protected readonly store = inject(GitLearningStore);
  readonly navigate = output<'command-input' | 'file-content'>();
  protected readonly hintOpen = linkedSignal(() => {
    this.store.checkpoint();
    return false;
  });
  protected readonly toggle = (value: boolean) => !value;
}
