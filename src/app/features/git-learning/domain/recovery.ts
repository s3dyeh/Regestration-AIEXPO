import {
  changed,
  clean,
  copy,
  createCommit,
  headTree,
  isAncestor,
  same,
  tip,
  type Event,
  type Files,
  type GitState,
} from './model';

type Outcome = { output: string; event: Event };
const result = (kind: string, output: string, text: string): Outcome => ({
  output,
  event: { kind, text },
});
export function requireNoOperation(s: GitState) {
  if (s.merging || s.stashConflicts.length)
    throw new Error('Finish or abort the current operation first.');
}
export function isPublished(s: GitState, id: string) {
  return (
    !!s.remote && Object.values(s.remote.branches).some((head) => isAncestor(s.remote!, id, head))
  );
}
export function amend(s: GitState, message: string): Outcome {
  requireNoOperation(s);
  const old = tip(s);
  if (!old) throw new Error('No commit to amend.');
  if (isPublished(s, old))
    throw new Error(
      'Lab guardrail: this commit is shared. Use git revert HEAD instead of rewriting published history.',
    );
  const id = createCommit(s, message, [...s.commits[old].parents]);
  return result(
    'amended',
    `[${s.head} ${id}] ${message}\nReplaces ${old}; previous object retained.`,
    'recovery.replacedTheLastCommitWithANew',
  );
}
export function softReset(s: GitState): Outcome {
  requireNoOperation(s);
  const old = tip(s),
    parent = old && s.commits[old].parents[0];
  if (!old || !parent)
    throw new Error('HEAD has no parent. This lab supports git reset --soft HEAD~1.');
  if (isPublished(s, old))
    throw new Error('Lab guardrail: HEAD is published. Use revert to preserve shared history.');
  s.branches[s.head] = parent;
  return result(
    'reset-soft',
    `HEAD moved ${old} → ${parent}. Index and working tree unchanged.`,
    'recovery.movedTheBranchBackOneStepThe',
  );
}
export function revertHead(s: GitState): Outcome {
  requireNoOperation(s);
  if (!clean(s)) throw new Error('Commit or stash changes before reverting in this lab.');
  const old = tip(s);
  if (!old || s.commits[old].parents.length !== 1)
    throw new Error(
      'This lab supports reverting HEAD with exactly one parent; root and merge commits are not supported.',
    );
  const parent = s.commits[old].parents[0];
  s.index = copy(s.commits[parent].tree);
  s.working = copy(s.index);
  const id = createCommit(s, `Revert "${s.commits[old].message}"`, [old]);
  return result(
    'reverted',
    `[${s.head} ${id}] Revert ${old}\nOriginal commit remains in history.`,
    'recovery.addedACommitReversingTheLastCommit',
  );
}
export function abortMerge(s: GitState): Outcome {
  if (!s.merging) throw new Error('No merge in progress. --abort does not undo a completed merge.');
  // This lab only starts merges with a clean index and working tree.
  s.working = copy(headTree(s));
  s.index = copy(s.working);
  s.merging = null;
  return result(
    'merge-aborted',
    'Merge aborted. HEAD unchanged; pre-merge files restored.',
    'recovery.abortedTheOngoingMergeAndRestoredThe',
  );
}

/** Bounded three-way application for stash: independent files or same-length line edits. */
function applyChanges(base: Files, current: Files, incoming: Files) {
  const tree = copy(current),
    conflicts: string[] = [];
  for (const file of changed(base, incoming)) {
    const b = base[file],
      l = current[file],
      r = incoming[file];
    if (l === b || l === r) {
      if (r === undefined) delete tree[file];
      else tree[file] = r;
      continue;
    }
    let merged: string | undefined;
    if (b !== undefined && l !== undefined && r !== undefined) {
      const bl = b.split('\n'),
        ll = l.split('\n'),
        rr = r.split('\n');
      if (bl.length === ll.length && ll.length === rr.length) {
        let conflict = false;
        merged = bl
          .map((line, i) => {
            if (ll[i] === rr[i] || rr[i] === line) return ll[i];
            if (ll[i] === line) return rr[i];
            conflict = true;
            return ll[i];
          })
          .join('\n');
        if (conflict) merged = undefined;
      }
    }
    if (merged === undefined) {
      conflicts.push(file);
      tree[file] =
        `<<<<<<< Updated upstream\n${l ?? ''}\n=======\n${r ?? ''}\n>>>>>>> Stashed changes`;
    } else tree[file] = merged;
  }
  return { tree, conflicts };
}
export function stash(s: GitState, args: string[]): Outcome {
  const [operation = 'push', ...rest] = args;
  if (!['push', 'list', 'show', 'apply', 'pop', 'drop'].includes(operation))
    throw new Error(
      'Supported: git stash [push [-m "Message"] | list | show | apply [--index] | pop [--index] | drop].',
    );
  const valid =
    operation === 'push'
      ? !rest.length || (rest.length === 2 && rest[0] === '-m' && !!rest[1].trim())
      : ['apply', 'pop'].includes(operation)
        ? !rest.length || (rest.length === 1 && rest[0] === '--index')
        : !rest.length;
  if (!valid)
    throw new Error('Unsupported stash arguments. This lab operates on stash@{0} only. Type help.');
  if (operation === 'list')
    return result(
      'inspect',
      s.stashes
        .map((entry, i) => `stash@{${i}}: On ${entry.branch}: ${entry.message}`)
        .join('\n') || 'No stash entries.',
      'recovery.stashesAreLocalTheListShowsThe',
    );
  const preview = s.stashes[0];
  if (operation === 'show') {
    if (!preview) throw new Error('No stash entries.');
    return result(
      'inspect',
      changed(s.commits[preview.base].tree, preview.working)
        .map((f) => `${f}\n${preview.working[f] ?? '(deleted)'}`)
        .join('\n'),
      'recovery.previewedStashContentOnlyNothingWasApplied',
    );
  }
  requireNoOperation(s);
  if (operation === 'push') {
    const base = tip(s);
    if (!base) throw new Error('Create a commit before stashing.');
    const tracked = new Set([...Object.keys(headTree(s)), ...Object.keys(s.index)]);
    const working = Object.fromEntries(Object.entries(s.working).filter(([f]) => tracked.has(f)));
    if (same(working, headTree(s)) && same(s.index, headTree(s)))
      return result(
        'unchanged',
        'No local changes to save.',
        'recovery.noTrackedFileChangesToStash',
      );
    s.stashes.unshift({
      id: `s${String(s.nextStashId++).padStart(3, '0')}`,
      base,
      branch: s.head,
      message: rest[1] ?? 'Work in progress',
      working: copy(working),
      index: copy(s.index),
    });
    const untracked = Object.fromEntries(
      Object.entries(s.working).filter(([f]) => !tracked.has(f)),
    );
    s.index = copy(headTree(s));
    s.working = { ...copy(s.index), ...untracked };
    return result(
      'stashed',
      'Saved working directory and index to stash@{0}. Untracked files not included.',
      'recovery.movedUnfinishedWorkIntoALocalStash',
    );
  }
  const entry = s.stashes[0];
  if (!entry) throw new Error('No stash entries.');
  if (operation === 'drop') {
    s.stashes.shift();
    return result(
      'stash-dropped',
      'Dropped stash@{0}. Working files unchanged.',
      'recovery.removedOnlyTheStashEntryRestoredFiles',
    );
  }
  if (!clean(s))
    throw new Error(
      'This lab requires a clean working tree before stash apply/pop. Commit or stash current edits first.',
    );
  const applied = applyChanges(s.commits[entry.base].tree, s.working, entry.working);
  s.working = applied.tree;
  s.stashConflicts = applied.conflicts;
  if (rest[0] === '--index' && !applied.conflicts.length) {
    const indexResult = applyChanges(s.commits[entry.base].tree, s.index, entry.index);
    if (indexResult.conflicts.length)
      throw new Error('Cannot restore the saved index. Retry without --index.');
    s.index = indexResult.tree;
  }
  if (applied.conflicts.length)
    return result(
      'stash-conflict',
      `CONFLICT in ${applied.conflicts.join(', ')}. Stash entry kept. Resolve and git add.`,
      'recovery.theDraftConflictsWithTheCurrentBranch',
    );
  if (operation === 'pop') s.stashes.shift();
  return result(
    operation === 'pop' ? 'stash-popped' : 'stash-applied',
    `Applied stash@{0}.${operation === 'pop' ? ' Entry removed.' : ' Entry kept.'}${rest.length ? ' Saved index restored.' : ' Changes are unstaged.'}`,
    operation === 'pop'
      ? 'recovery.restoredTheDraftAndDroppedTheStash'
      : 'recovery.restoredTheDraftAndKeptTheStash',
  );
}
