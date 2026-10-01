import test from 'node:test';
import assert from 'node:assert/strict';
import { baseRepository, loadScenario } from '../../../src/app/features/git-learning/domain/scenarios';
import { copy, editFile, execute, headTree, tip, type GitState } from '../../../src/app/features/git-learning/domain/engine';

function run(s: GitState, command: string) {
  const r = execute(command, s);
  assert.equal(r.error, undefined, command + ': ' + r.error);
  return r.state;
}
function commit(s: GitState, file: string, text: string) {
  return run(run(editFile(s, file, text), 'git add .'), 'git commit -m "Change"');
}
test('amend replaces the tip with the same parents and leaves the old object immutable', () => {
  let s = commit(baseRepository(), 'event.txt', 'Bad');
  const old = tip(s)!,
    object = copy(s.commits[old]);
  s = run(editFile(s, 'event.txt', 'Fixed'), 'git add .');
  s = run(s, 'git commit --amend -m "Fixed message"');
  assert.notEqual(tip(s), old);
  assert.deepEqual(s.commits[old], object);
  assert.deepEqual(s.commits[tip(s)!].parents, object.parents);
  assert.equal(headTree(s)['event.txt'], 'Fixed');
});
test('soft reset moves only the branch and keeps both working and staged snapshots', () => {
  let s = commit(baseRepository(), 'event.txt', 'Staged');
  const old = tip(s)!,
    parent = s.commits[old].parents[0];
  s = editFile(s, 'event.txt', 'Unstaged');
  const index = copy(s.index),
    working = copy(s.working);
  s = run(s, 'git reset --soft HEAD~1');
  assert.equal(tip(s), parent);
  assert.deepEqual(s.index, index);
  assert.deepEqual(s.working, working);
  assert.ok(s.commits[old]);
});
test('published amend/reset are explicitly guarded; revert adds a pushable correction', () => {
  let s = loadScenario('remote');
  s = run(s, 'git push');
  const shared = tip(s)!,
    old = copy(s.commits[shared]);
  for (const cmd of ['git commit --amend -m "Rewrite"', 'git reset --soft HEAD~1']) {
    const r = execute(cmd, s);
    assert.match(r.error!, /Lab guardrail/);
    assert.deepEqual(r.state, s);
  }
  s = run(s, 'git revert HEAD');
  assert.deepEqual(s.commits[shared], old);
  assert.deepEqual(s.commits[tip(s)!].parents, [shared]);
  assert.deepEqual(headTree(s), s.commits[old.parents[0]].tree);
  s = run(s, 'git push');
  assert.equal(s.remote?.branches.main, tip(s));
});
test('abort restores pre-merge files even after editing and staging a resolution; commits survive', () => {
  const start = loadScenario('conflict');
  let s = run(start, 'git merge venue');
  s = run(editFile(s, 'event.txt', 'Resolved'), 'git add event.txt');
  s = run(s, 'git merge --abort');
  assert.deepEqual(s.working, start.working);
  assert.deepEqual(s.index, start.index);
  assert.deepEqual(s.commits, start.commits);
  assert.deepEqual(s.branches, start.branches);
  assert.equal(s.merging, null);
  const r = execute('git merge --abort', s);
  assert.match(r.error!, /No merge/);
  assert.deepEqual(r.state, s);
});
test('stash preserves index/working separation, untracked files, and HEAD', () => {
  let s = run(editFile(baseRepository(), 'event.txt', 'Stage'), 'git add event.txt');
  s = editFile(s, 'event.txt', 'Work');
  s = editFile(s, 'notes.txt', 'Untracked');
  const before = copy(s);
  s = run(s, 'git stash push -m "Two versions"');
  assert.equal(tip(s), tip(before));
  assert.equal(s.stashes[0].index['event.txt'], 'Stage');
  assert.equal(s.stashes[0].working['event.txt'], 'Work');
  assert.equal(s.stashes[0].working['notes.txt'], undefined);
  assert.equal(s.working['notes.txt'], 'Untracked');
  assert.deepEqual(s.index, headTree(s));
});
test('apply keeps the stash and defaults to unstaged; --index restores the saved index', () => {
  let s = run(editFile(baseRepository(), 'event.txt', 'Stage'), 'git add event.txt');
  s = editFile(s, 'event.txt', 'Work');
  s = run(s, 'git stash');
  const applied = run(s, 'git stash apply');
  assert.equal(applied.stashes.length, 1);
  assert.equal(applied.working['event.txt'], 'Work');
  assert.deepEqual(applied.index, headTree(applied));
  const indexed = run(s, 'git stash apply --index');
  assert.equal(indexed.index['event.txt'], 'Stage');
  assert.equal(indexed.working['event.txt'], 'Work');
  assert.equal(indexed.stashes.length, 1);
});
test('pop deletes only on success; failed application keeps the saved draft until explicitly dropped', () => {
  let s = run(editFile(baseRepository(), 'event.txt', 'Draft'), 'git stash');
  const base = copy(s);
  const popped = run(s, 'git stash pop');
  assert.equal(popped.stashes.length, 0);
  assert.equal(popped.working['event.txt'], 'Draft');
  assert.equal(tip(popped), tip(s));
  s = commit(base, 'event.txt', 'Other');
  const parent = tip(s)!;
  s = run(s, 'git stash pop');
  assert.equal(s.stashes.length, 1);
  assert.deepEqual(s.stashConflicts, ['event.txt']);
  assert.match(s.working['event.txt'], /<<<<<<< Updated upstream/);
  assert.equal(s.merging, null);
  const rejected = execute('git add event.txt', s);
  assert.ok(rejected.error);
  assert.deepEqual(rejected.state, s);
  s = run(editFile(s, 'event.txt', 'Resolved'), 'git add event.txt');
  s = run(s, 'git commit -m "Resolve stash"');
  assert.deepEqual(s.commits[tip(s)!].parents, [parent]);
  s = run(s, 'git stash drop');
  assert.equal(s.stashes.length, 0);
  assert.equal(s.working['event.txt'], 'Resolved');
});
test('stash merges independent edits on a changed base and drop removes only newest entry', () => {
  let s = baseRepository();
  const original = headTree(s)['event.txt'];
  s = run(editFile(s, 'event.txt', original.replace('Room A', 'Courtyard')), 'git stash');
  s = commit(s, 'event.txt', original.replace('10:00', '12:00'));
  s = run(s, 'git stash apply');
  assert.match(s.working['event.txt'], /Courtyard/);
  assert.match(s.working['event.txt'], /12:00/);
  assert.deepEqual(s.stashConflicts, []);
  s = run(s, 'git stash push -m "Second"');
  assert.equal(s.stashes.length, 2);
  const oldest = s.stashes[1];
  s = run(s, 'git stash drop');
  assert.deepEqual(s.stashes, [oldest]);
});
test('restore staged keeps the edit; plain restore discards it; invalid batches are atomic', () => {
  let s = baseRepository();
  const original = headTree(s)['event.txt'];
  s = run(editFile(s, 'event.txt', 'Experiment'), 'git add event.txt');
  s = run(s, 'git restore --staged event.txt');
  assert.equal(s.index['event.txt'], original);
  assert.equal(s.working['event.txt'], 'Experiment');
  const invalid = execute('git restore event.txt missing.txt', s);
  assert.ok(invalid.error);
  assert.deepEqual(invalid.state, s);
  s = run(s, 'git restore event.txt');
  assert.equal(s.working['event.txt'], original);
});
test('unsupported destructive forms, merge revert, dirty pop and bad stash flags fail atomically', () => {
  let s = run(loadScenario('branches'), 'git merge venue');
  for (const cmd of [
    'git revert HEAD',
    'git reset --hard HEAD~1',
    'git stash pop --bogus',
    'git stash clear',
  ]) {
    const r = execute(cmd, s);
    assert.ok(r.error, cmd);
    assert.deepEqual(r.state, s);
  }
  s = run(editFile(s, 'event.txt', 'Draft'), 'git stash');
  s = editFile(s, 'event.txt', 'Keep me');
  const r = execute('git stash pop', s);
  assert.ok(r.error);
  assert.deepEqual(r.state, s);
});
