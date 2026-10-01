import { DOCUMENT } from '@angular/common';
import { computed, DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { challenges, requirements } from '../curriculum/challenges';
import { changed, headTree, tip } from '../domain/engine';
import { learningReducer, progressKey, restoreProgress, serializeProgress } from './progress';
import type { BoothAction } from './session';

@Injectable()
export class GitLearningStore {
  private readonly browser = inject(DOCUMENT).defaultView;
  private readonly state = signal(this.load());
  private readonly storageFailed = signal(false);
  readonly session = computed(() => this.state().session);
  readonly checkpoint = computed(() => this.session().checkpoint);
  readonly git = computed(() => this.session().git);
  readonly challenge = computed(() => challenges[this.session().step]);
  readonly goals = computed(() => requirements(this.session()));
  readonly complete = computed(() => this.goals().every((goal) => goal.done));
  readonly final = computed(() => this.challenge().scene === 'finish');
  readonly head = computed(() => headTree(this.git()));
  readonly tip = computed(() => tip(this.git()));
  readonly files = computed(() => Object.keys(this.git().working));
  readonly editorContent = computed(
    () =>
      this.session().drafts[this.session().selectedFile] ??
      this.git().working[this.session().selectedFile] ??
      '',
  );
  readonly editorDirty = computed(() =>
    Object.hasOwn(this.session().drafts, this.session().selectedFile),
  );
  readonly mode = computed(
    () => this.challenge().mode ?? (this.session().step < 5 ? 'solo' : 'team'),
  );
  readonly showEditor = computed(
    () =>
      !!this.challenge().edit ||
      ['snapshot', 'graph', 'conflict', 'recovery', 'stash'].includes(this.challenge().scene),
  );
  readonly savedStatus = computed(() =>
    this.storageFailed()
      ? 'الحفظ غير متاح — أبقِ هذه الصفحة مفتوحة للاحتفاظ بتقدّمك'
      : this.state().recovered
        ? 'بدأنا جلسة جديدة لأن الحفظ السابق غير صالح.'
        : 'تقدّمك محفوظ تلقائيًا على هذا المتصفح',
  );
  readonly challenges = challenges;
  readonly lessons = challenges.slice(0, -1);
  readonly progress = computed(() => ({
    completed: Math.min(this.session().step, this.lessons.length),
    total: this.lessons.length,
    percent: Math.round((this.session().step / this.lessons.length) * 100),
  }));
  readonly nextGoal = computed(() => this.goals().find((goal) => !goal.done)?.label ?? null);
  readonly repositorySummary = computed(() => {
    const git = this.git();
    return {
      drafts: Object.keys(this.session().drafts).length,
      unstaged: changed(git.index, git.working).length,
      staged: changed(this.head(), git.index).length,
      commits: Object.keys(git.commits).length,
      branch: git.head,
    };
  });
  constructor() {
    effect(() => this.persist());
    const flush = () => this.persist();
    this.browser?.addEventListener('pagehide', flush);
    inject(DestroyRef).onDestroy(() => {
      this.persist();
      this.browser?.removeEventListener('pagehide', flush);
    });
  }
  dispatch(action: BoothAction): void {
    this.state.update((state) => learningReducer(state, action));
  }
  quickEdit(edit: { file: string; find?: string; value: string }): void {
    const current = this.session().drafts[edit.file] ?? this.git().working[edit.file] ?? '';
    this.dispatch({ type: 'editor/select', file: edit.file });
    this.dispatch({
      type: 'editor/draft',
      content: edit.find ? current.replace(edit.find, edit.value) : edit.value,
    });
  }
  private load() {
    try {
      return restoreProgress(this.browser?.localStorage.getItem(progressKey) ?? null);
    } catch {
      return restoreProgress(null);
    }
  }
  private persist(): void {
    const journal = this.state().journal;
    try {
      if (!this.browser) return;
      this.browser.localStorage.setItem(progressKey, serializeProgress(journal));
      this.storageFailed.set(false);
    } catch {
      this.storageFailed.set(true);
    }
  }
}
