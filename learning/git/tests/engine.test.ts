import test from 'node:test';
import assert from 'node:assert/strict';
import {
  execute,
  editFile,
  tip,
  headTree,
  copy,
  clean,
  resetSession,
  tokenize,
} from '../../../src/app/features/git-learning/domain/engine';
import { baseRepository, loadScenario } from '../../../src/app/features/git-learning/domain/scenarios';
import type { GitState } from '../../../src/app/features/git-learning/domain/engine';
function run(s: GitState, c: string) {
  const r = execute(c, s);
  assert.equal(r.error, undefined, r.output);
  return r.state;
}
test('init does not commit or upload; quoted messages tokenize', () => {
  let s = resetSession();
  s.working.a = 'one';
  s = run(s, 'git init');
  assert.equal(tip(s), null);
  assert.equal(s.remote, null);
  assert.deepEqual(tokenize('git commit -m "a long message"'), [
    'git',
    'commit',
    '-m',
    'a long message',
  ]);
});
test('staging freezes content, commit leaves later work untouched and preserves history', () => {
  let s = loadScenario('snapshot');
  const original = copy(s.commits.c001);
  s = run(s, 'git add event.txt');
  s = editFile(s, 'event.txt', s.working['event.txt'].replace('Auditorium', 'Library'));
  s = run(s, 'git commit -m "Save staged venue"');
  assert.match(headTree(s)['event.txt'], /Auditorium/);
  assert.match(s.working['event.txt'], /Library/);
  assert.deepEqual(s.commits.c001, original);
  assert.equal(s.remote, null);
});
test('branch is a reference; switch restores snapshot', () => {
  let s = baseRepository();
  s = run(s, 'git switch -c venue');
  assert.equal(s.branches.main, s.branches.venue);
  assert.equal(Object.keys(s.commits).length, 1);
  s = editFile(s, 'event.txt', 'new');
  s = run(s, 'git add .');
  s = run(s, 'git commit -m "New"');
  assert.equal(s.branches.main, 'c001');
  s = run(s, 'git switch main');
  assert.match(s.working['event.txt'], /Room A/);
});
test('fast-forward creates no commit', () => {
  let s = baseRepository();
  s = run(s, 'git switch -c venue');
  s = editFile(s, 'event.txt', 'new');
  s = run(s, 'git add .');
  s = run(s, 'git commit -m "New"');
  s = run(s, 'git switch main');
  s = run(s, 'git merge venue');
  assert.equal(Object.keys(s.commits).length, 2);
  assert.equal(tip(s), s.branches.venue);
});
test('divergent non-conflicting merge has two parents and combines files', () => {
  let s = loadScenario('branches');
  const before = tip(s);
  s = run(s, 'git merge venue');
  assert.deepEqual(s.commits[tip(s)!].parents, [before, s.branches.venue]);
  assert.match(s.working['event.txt'], /Auditorium/);
  assert.match(s.working['program.txt'], /Open source/);
  assert.ok(clean(s));
});
test('line changes at distinct positions merge correctly', () => {
  let s = baseRepository();
  s = run(s, 'git switch -c venue');
  s = editFile(s, 'event.txt', s.working['event.txt'].replace('Room A', 'Library'));
  s = run(s, 'git add .');
  s = run(s, 'git commit -m "Venue"');
  s = run(s, 'git switch main');
  s = editFile(s, 'event.txt', s.working['event.txt'].replace('10:00', '12:00'));
  s = run(s, 'git add .');
  s = run(s, 'git commit -m "Time"');
  s = run(s, 'git merge venue');
  assert.match(s.working['event.txt'], /Library/);
  assert.match(s.working['event.txt'], /12:00/);
  assert.equal(s.merging, null);
});
test('conflict must be resolved, staged, and committed with two parents', () => {
  let s = loadScenario('conflict');
  s = run(s, 'git merge venue');
  assert.deepEqual(s.merging?.unresolved, ['event.txt']);
  assert.ok(execute('git commit -m "bad"', s).error);
  assert.ok(execute('git add .', s).error);
  s = editFile(s, 'event.txt', 'Event: Campus Code Day\nVenue: Auditorium\nTime: 10:00');
  s = run(s, 'git add event.txt');
  s = run(s, 'git commit -m "Resolve venue"');
  assert.equal(s.merging, null);
  assert.equal(s.commits[tip(s)!].parents.length, 2);
});
test('fetch downloads history but changes neither local branch nor files; pull ff-only advances', () => {
  let s = loadScenario('fetch');
  const files = copy(s.working),
    local = tip(s);
  s = run(s, 'git fetch');
  assert.equal(tip(s), local);
  assert.deepEqual(s.working, files);
  assert.equal(s.tracking.main, 'r001');
  s = run(s, 'git pull --ff-only');
  assert.equal(tip(s), 'r001');
  assert.match(s.working['program.txt'], /Team challenge/);
});
test('push only transfers committed data and rejects divergent remote', () => {
  let s = loadScenario('remote');
  s = editFile(s, 'event.txt', 'UNCOMMITTED');
  s = run(s, 'git push');
  assert.notEqual(s.remote!.commits[tip(s)!].tree['event.txt'], 'UNCOMMITTED');
  s = loadScenario('fetch');
  s = editFile(s, 'event.txt', 'local');
  s = run(s, 'git add .');
  s = run(s, 'git commit -m "Local"');
  const before = copy(s);
  assert.ok(execute('git push', s).error);
  assert.deepEqual(s, before);
  assert.ok(execute('git pull --ff-only', s).error);
});
test('invalid commands are atomic, including multi-file staging and parser errors', () => {
  const s = loadScenario('snapshot');
  for (const cmd of [
    'rm -rf /',
    'git add event.txt missing.txt',
    'git commit -m "broken',
    'git push --force',
    'git switch -c __proto__',
    'git status && git add .',
    'git merge missing',
    'git log --all',
  ]) {
    const before = copy(s),
      r = execute(cmd, s);
    assert.ok(r.error, cmd);
    assert.deepEqual(r.state, before);
    assert.deepEqual(s, before);
  }
});
test('untracked files do not appear in git diff', () => {
  let s = baseRepository();
  s = editFile(s, 'new.txt', 'secret');
  assert.equal(execute('git diff', s).output, 'No differences.');
  assert.match(execute('git status', s).output, /new.txt/);
});
test('inherited property names are not files and cannot corrupt repository state', () => {
  const s = baseRepository();
  for (const path of ['constructor', '__proto__', 'toString']) {
    const r = execute('git add ' + path, s);
    assert.ok(r.error);
    assert.deepEqual(r.state, s);
    assert.equal(execute('git status', r.state).error, undefined);
  }
});
test('30 complete simulated groups have isolated state and deterministic reset', () => {
  for (let i = 0; i < 30; i++) {
    let s = loadScenario('snapshot');
    s = run(s, 'git add .');
    s = run(s, 'git commit -m "Group"');
    s = loadScenario('branches');
    s = run(s, 'git merge venue');
    s = loadScenario('remote');
    s = run(s, 'git push');
    assert.deepEqual(resetSession(), resetSession());
    assert.equal(Object.keys(loadScenario('branches').commits).length, 3);
    assert.equal(loadScenario('snapshot').nextId, 2);
  }
});
