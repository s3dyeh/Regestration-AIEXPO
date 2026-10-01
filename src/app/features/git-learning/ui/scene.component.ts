import { TranslocoPipe } from '@jsverse/transloco';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { GitLearningStore } from '../state/git-learning.store';
import { WorkshopDialogService } from '../state/workshop-dialog.service';
import { changed, headTree, tip } from '../domain/engine';
import { LearningCommitGraphComponent } from './commit-graph.component';
@Component({
  selector: 'app-learning-scene',
  imports: [TranslocoPipe, LearningCommitGraphComponent],
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
        label: 'scene.workingFiles',
        en: 'common.workingTree',
        value: Object.hasOwn(git.working, file) ? git.working[file] : undefined,
        className: 'working',
        status: changed(git.index, git.working).includes(file)
          ? 'scene.unstagedChange'
          : 'scene.matchesTheIndex',
      },
      {
        label: 'scene.readyToCommit',
        en: 'common.stagingIndex',
        value: Object.hasOwn(git.index, file) ? git.index[file] : undefined,
        className: 'staged',
        status: changed(head, git.index).includes(file)
          ? 'scene.contentWaitingForACommit'
          : 'scene.matchesTheLastCommit',
      },
      {
        label: 'scene.lastSavedState',
        en: 'common.headSnapshot',
        value: Object.hasOwn(head, file) ? head[file] : undefined,
        className: 'saved',
        status: tip(git) || 'scene.noCommits',
      },
    ];
  });
  protected readonly conflict = computed<{ branch: string; text: string | null }[]>(() =>
    ['main', 'time'].map((branch) => ({
      branch,
      text:
        this.store.git().commits[this.store.git().branches[branch] ?? '']?.tree['event.txt'] ??
        null,
    })),
  );
  protected readonly remote = computed<{
    id: string | null | undefined;
    program: string | null;
    event: string | null;
    commits: string[];
  }>(() => {
    const git = this.store.git(),
      id = git.remote?.branches['main'];
    return {
      id,
      program: git.remote?.commits[id ?? '']?.tree['program.txt'] ?? null,
      event: git.remote?.commits[id ?? '']?.tree['event.txt'] ?? null,
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
      { label: 'scene.workingFile', value: git.working[file], before: checkpointGit.working[file] },
      { label: 'scene.stagedVersion', value: git.index[file], before: checkpointGit.index[file] },
      { label: 'scene.savedHeadVersion', value: current?.tree[file], before: old?.tree[file] },
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
        ? 'scene.cancelTheOperationNotHistory'
        : id === 'revert'
          ? 'scene.reversePublishedWorkHistoryMovesForward'
          : id === 'soft-reset'
            ? 'scene.moveOnlyTheBranch'
            : id === 'amend'
              ? 'scene.replaceTheLastLocalCommit'
              : 'scene.experimentWithLocalHistory',
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
