import {
  copy,
  tip,
  clean,
  isAncestor,
  mergeBase,
  headTree,
  createCommit,
  type GitState,
  type Event,
  type Files,
} from './model';

export function integrate(
  s: GitState,
  target: string,
  branch: string,
  ffOnly: boolean,
): { output: string; event: Event } {
  const ours = tip(s);
  if (isAncestor(s, target, ours))
    return {
      output: 'Already up to date.',
      event: { kind: 'unchanged', text: 'التاريخ المطلوب موجود بالفعل في فرعك.' },
    };
  if (!clean(s)) throw new Error('Save and commit your changes before merging in this lab.');
  if (s.merging) throw new Error('Finish the current merge first.');
  if (isAncestor(s, ours, target)) {
    s.branches[s.head] = target;
    s.index = copy(s.commits[target].tree);
    s.working = copy(s.index);
    return {
      output: `Fast-forward ${ours ?? '(empty)'}..${target}`,
      event: {
        kind: 'fast-forward',
        text: 'تحرّك مؤشّر الفرع إلى commit موجود. لم يُنشأ merge commit.',
      },
    };
  }
  if (ffOnly)
    throw new Error(
      'Not possible to fast-forward. The histories have diverged; inspect and merge explicitly.',
    );
  const baseId = ours && mergeBase(s, ours, target);
  if (!baseId) throw new Error('Unrelated histories are outside this lab.');
  const base = s.commits[baseId].tree,
    left = headTree(s),
    right = s.commits[target].tree;
  const merged: Files = {},
    conflicts: string[] = [];
  for (const file of Object.keys({ ...base, ...left, ...right })) {
    const b = base[file],
      l = left[file],
      r = right[file];
    let value: string | undefined;
    if (l === r) value = l;
    else if (l === b) value = r;
    else if (r === b) value = l;
    else if (
      b !== undefined &&
      l !== undefined &&
      r !== undefined &&
      b.split('\n').length === l.split('\n').length &&
      l.split('\n').length === r.split('\n').length
    ) {
      const bl = b.split('\n'),
        ll = l.split('\n'),
        rr = r.split('\n');
      let conflict = false;
      value = bl
        .map((v, i) => {
          if (ll[i] === rr[i]) return ll[i];
          if (ll[i] === v) return rr[i];
          if (rr[i] === v) return ll[i];
          conflict = true;
          return ll[i];
        })
        .join('\n');
      if (conflict) {
        conflicts.push(file);
        value = `<<<<<<< HEAD\n${l}\n=======\n${r}\n>>>>>>> ${branch}`;
      }
    } else {
      conflicts.push(file);
      value = `<<<<<<< HEAD\n${l ?? ''}\n=======\n${r ?? ''}\n>>>>>>> ${branch}`;
    }
    if (value !== undefined) merged[file] = value;
  }
  s.working = merged;
  s.index = copy(merged);
  if (conflicts.length) {
    // Index's unresolved entries are represented by merging.unresolved, not marker blobs.
    for (const f of conflicts) {
      if (left[f] !== undefined) s.index[f] = left[f];
      else delete s.index[f];
    }
    s.merging = { parent: target, branch, unresolved: conflicts };
    return {
      output: `CONFLICT in ${conflicts.join(', ')}\nEdit the file, remove markers, git add, then git commit.`,
      event: {
        kind: 'conflict',
        text: 'التاريخ محفوظ. Git يحتاج قرارك في المحتوى المتعارض؛ عدّل الملف ثم جهّزه واحفظ الدمج.',
      },
    };
  }
  const id = createCommit(s, `Merge branch '${branch}'`, [ours!, target]);
  return {
    output: `Merge made: ${id} (two parents)`,
    event: {
      kind: 'merged',
      text: 'اجتمع التعديلان في snapshot جديد. لهذا الـcommit أبوان يشيران للمسارين.',
    },
  };
}
