import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { GitLearningStore } from '../state/git-learning.store';
import { WorkshopDialogService } from '../state/workshop-dialog.service';
import { changed, headTree, tip } from '../domain/engine';
import { LearningCommitGraphComponent } from './commit-graph.component';
@Component({
  selector: 'app-learning-scene',
  imports: [LearningCommitGraphComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './scene.component.html',
})
export class LearningSceneComponent {
  protected readonly store = inject(GitLearningStore);
  protected readonly dialog = inject(WorkshopDialogService);
  protected readonly commits = computed(() => Object.keys(this.store.git().commits));
  protected readonly branches = computed(() =>
    Object.entries(this.store.git().branches).map(([name, id]) => ({ name, id })),
  );
  protected readonly snapshot = computed(() => {
    const git = this.store.git(),
      file = this.store.session().selectedFile,
      head = this.store.head();
    return [
      {
        label: 'ملفات العمل',
        en: 'WORKING TREE',
        value: Object.hasOwn(git.working, file) ? git.working[file] : undefined,
        className: 'working',
        status: changed(git.index, git.working).includes(file)
          ? 'تعديل غير مجهّز'
          : 'يطابق الـindex',
      },
      {
        label: 'جاهز للحفظ',
        en: 'STAGING / INDEX',
        value: Object.hasOwn(git.index, file) ? git.index[file] : undefined,
        className: 'staged',
        status: changed(head, git.index).includes(file) ? 'محتوى ينتظر commit' : 'يطابق آخر commit',
      },
      {
        label: 'آخر حالة محفوظة',
        en: 'HEAD SNAPSHOT',
        value: Object.hasOwn(head, file) ? head[file] : undefined,
        className: 'saved',
        status: tip(git) || 'لا commits',
      },
    ];
  });
  protected readonly conflict = computed(() =>
    ['main', 'time'].map((branch) => ({
      branch,
      text:
        this.store.git().commits[this.store.git().branches[branch] ?? '']?.tree['event.txt'] ??
        'لم يُنشأ بعد',
    })),
  );
  protected readonly remote = computed(() => {
    const git = this.store.git(),
      id = git.remote?.branches['main'];
    return {
      id,
      program: git.remote?.commits[id ?? '']?.tree['program.txt'] ?? '(empty repository)',
      event: git.remote?.commits[id ?? '']?.tree['event.txt'] ?? '(not received)',
      commits: Object.keys(git.remote?.commits ?? {}),
    };
  });
  protected readonly recovery = computed(() => {
    const { git, checkpointGit } = this.store.session(),
      id = this.store.challenge().id,
      before = tip(checkpointGit),
      after = tip(git),
      old = before ? checkpointGit.commits[before] : undefined,
      current = after ? git.commits[after] : undefined;
    const abort = id === 'abort',
      file = abort || id === 'revert' ? 'event.txt' : 'program.txt';
    const cards = [
      { label: 'ملف العمل', value: git.working[file], before: checkpointGit.working[file] },
      { label: 'النسخة المجهّزة', value: git.index[file], before: checkpointGit.index[file] },
      { label: 'نسخة HEAD المحفوظة', value: current?.tree[file], before: old?.tree[file] },
    ].map((card) => {
      const old = (card.before ?? '').split('\n'),
        current = (card.value ?? '').split('\n');
      return {
        ...card,
        removed: old.filter((line) => !current.includes(line)),
        lines: current.map((text) => ({ text, added: !old.includes(text) })),
      };
    });
    return {
      before,
      after,
      old,
      current,
      file,
      cards,
      changed: after !== before || (abort && !git.merging),
      title: abort
        ? 'إلغاء العملية، لا التاريخ'
        : id === 'revert'
          ? 'عكس منشور · تاريخ يتقدّم'
          : id === 'soft-reset'
            ? 'تحريك الفرع فقط'
            : id === 'amend'
              ? 'استبدال آخر commit محلي'
              : 'تاريخك المحلي تحت التجربة',
      operation: abort
        ? 'abort'
        : id === 'revert'
          ? 'new commit'
          : id === 'soft-reset'
            ? 'move ref'
            : id === 'amend'
              ? 'replace'
              : 'commit',
      shared: git.remote?.branches['main'] === after,
      staged: changed(headTree(git), git.index).length,
      unstaged: changed(git.index, git.working).length,
    };
  });
  protected readonly stash = computed(() => {
    const { git, checkpointGit } = this.store.session(),
      captured = git.stashes[0] ?? checkpointGit.stashes[0];
    const files = [
      ...new Set([
        ...changed(headTree(git), git.working),
        ...Object.keys(captured?.working ?? {}).filter(
          (file) => captured?.working[file] !== git.commits[captured.base]?.tree[file],
        ),
      ]),
    ];
    return {
      file: files[0] ?? 'program.txt',
      staged: changed(headTree(git), git.index).length,
      unstaged: changed(git.index, git.working).length,
    };
  });
}
