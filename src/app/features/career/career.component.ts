import { GithubClient } from './github-client';
import { buildCareerPlan, careerFocuses, isFocusId, updateMilestones } from './career-path';
import type { FocusId } from './career-path';
import { CareerPathComponent } from './career-path.component';
import { SCORING_VERSION, summarizeScore } from './github-score';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
  linkedSignal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { analyzeGithub, githubUsername, type GithubReport } from './github-analysis';

@Component({
  selector: 'app-career',
  imports: [RouterLink, CareerPathComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './career.component.html',
  styleUrls: ['./career-report.scss', './career.component.scss', './career-score.scss'],
})
export class CareerComponent {
  protected readonly input = signal('');
  protected readonly token = signal('');
  private githubClient = new GithubClient();
  protected setToken(value: string): void {
    if (this.pending()) return;
    this.token.set(value.trim());
    this.githubClient.clear();
    this.githubClient = new GithubClient(this.token());
    this.error.set('');
  }
  protected readonly pending = signal(false);
  protected readonly progress = signal('');
  protected readonly error = signal('');
  protected readonly report = signal<GithubReport | null>(null);
  protected readonly tab = signal('Score breakdown');
  protected readonly tabs = [
    'Score breakdown',
    'Evidence profile',
    'Career discovery',
    'Career path',
    'Next 3 moves',
  ];
  private controller?: AbortController;
  private readonly destroyRef = inject(DestroyRef);
  constructor() {
    inject(DestroyRef).onDestroy(() => this.controller?.abort());
  }
  protected readonly summarizeScore = summarizeScore;
  protected readonly score = computed(() =>
    summarizeScore(this.report()?.repositories.flatMap((repo) => repo.categories) ?? []),
  );
  protected readonly categoryScores = computed(() => {
    const categories = this.report()?.repositories.flatMap((repo) => repo.categories) ?? [];
    return [...new Set(categories.map((category) => category.name))].map((name) => ({
      name,
      ...summarizeScore(categories.filter((category) => category.name === name)),
    }));
  });
  protected readonly scoringVersion = SCORING_VERSION;
  protected readonly checkPoints = (value: number | null, weight: number) =>
    value === null ? 'Unassessed' : `${Math.round(value * weight * 10) / 10} / ${weight} points`;
  protected readonly skills = computed(() => {
    const repos = this.report()?.repositories ?? [];
    return [...new Set(repos.flatMap((repo) => repo.skills))].map((name) => ({
      name,
      repos: repos.filter((repo) => repo.skills.includes(name)),
    }));
  });
  protected readonly focus = signal<FocusId>('software');
  private readonly completedMilestones = linkedSignal<string[]>(() => {
    this.focus();
    this.report();
    return [];
  });
  protected readonly careerPlan = computed(() =>
    buildCareerPlan(this.focus(), this.report()?.repositories ?? [], this.completedMilestones()),
  );
  protected chooseFocus(value: string): void {
    if (isFocusId(value)) this.focus.set(value);
  }
  protected validateMilestone(event: { id: string; done: boolean }): void {
    this.completedMilestones.set(updateMilestones(this.careerPlan(), event.id, event.done));
  }
  protected readonly roles = computed(() =>
    careerFocuses.map((focus) => {
      const plan = buildCareerPlan(focus.id, this.report()?.repositories ?? []);
      return {
        name: focus.name,
        id: focus.id,
        capabilities: plan.steps.map((step) => step.title),
        found: plan.steps.filter((step) => step.status === 'observed').map((step) => step.title),
      };
    }),
  );
  protected readonly actions = computed(() => {
    const repos = this.report()?.repositories ?? [];
    const chosen = new Set<string>();
    return repos
      .flatMap((repo) =>
        repo.categories.flatMap((category) =>
          category.checks
            .filter((check) => check.applicable && check.value !== null && check.value < 1)
            .map((check) => ({ repo: repo.name, check, gap: check.weight * (1 - check.value!) })),
        ),
      )
      .sort((a, b) => b.gap - a.gap)
      .filter(({ check }) => {
        if (chosen.has(check.label)) return false;
        chosen.add(check.label);
        return true;
      })
      .slice(0, 3)
      .map(({ repo, check, gap }) => ({
        title: check.label,
        text: repo + ': ' + check.action,
        why:
          check.evidence +
          ' Potential improvement: ' +
          Math.round(gap * 10) / 10 +
          ' raw rubric points in this repository; not a promised profile-score increase.',
      }));
  });
  protected analyze(event: Event): void {
    event.preventDefault();
    if (this.pending()) return;
    this.error.set('');
    let username: string;
    try {
      username = githubUsername(this.input());
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Enter a valid GitHub profile.');
      return;
    }
    this.controller = new AbortController();
    this.pending.set(true);
    // Preserve an existing report while a refresh runs or fails.
    const controller = this.controller;
    analyzeGithub(
      username,
      controller.signal,
      (message) => this.progress.set(message),
      this.githubClient,
    )
      .pipe(
        finalize(() => this.pending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (report) => {
          this.report.set(report);
          this.tab.set('Score breakdown');
        },
        error: (error: unknown) => {
          if (!controller.signal.aborted)
            this.error.set(
              error instanceof TypeError
                ? 'Could not reach GitHub. Check your connection and try again.'
                : error instanceof Error
                  ? error.message
                  : 'Analysis failed. Please retry.',
            );
        },
      });
  }
  protected cancel(): void {
    this.controller?.abort();
  }
  protected download(): void {
    const report = this.report();
    if (!report) return;
    const content = {
      ...report,
      scoringVersion: SCORING_VERSION,
      methodology:
        'Custom repository-evidence rubric v2. Weights: README20, commit messages15, code maintenance20, documentation20, automation/stewardship25. Weighted fractional evidence pooled across selected repositories. Score=100*earned/assessed, withheld below60% weighted coverage. Bounds substitute unknown evidence with all0/all1, not statistical confidence. Custom weights are not empirically validated. No stars, commit volume or developer-ability ranking.',
      sources: [
        'https://github.com/ossf/scorecard/blob/main/docs/checks.md',
        'https://www.bestpractices.dev/en/criteria/0',
        'https://www.microsoft.com/en-us/research/publication/the-space-of-developer-productivity-theres-more-to-it-than-you-think/',
      ],
      score: this.score(),
      categoryScores: this.categoryScores(),
      roles: this.roles(),
      actions: this.actions(),
      careerPlan: this.careerPlan(),
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `careerlens-${report.username}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
