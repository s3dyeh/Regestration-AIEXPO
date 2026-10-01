import test from 'node:test';
import assert from 'node:assert/strict';
import {
  boothReducer,
  createSession,
  stationComplete,
  type BoothSession,
  type BoothAction,
} from '../../../src/app/features/git-learning/state/session';
import { challenges } from '../../../src/app/features/git-learning/curriculum/challenges';

function driver(initial = createSession()) {
  let state = initial;
  return {
    get state() {
      return state;
    },
    act(action: BoothAction) {
      state = boothReducer(state, action);
    },
    command(command: string) {
      this.act({ type: 'terminal/execute', command });
      assert.equal(state.transcript.at(-1)?.error, false, command);
    },
    edit(file: string, content: string) {
      this.act({ type: 'editor/select', file });
      this.act({ type: 'editor/draft', content });
      this.act({ type: 'editor/save' });
    },
    next() {
      assert.ok(stationComplete(state), challenges[state.step].id);
      const previous = state;
      this.act({ type: 'wizard/next' });
      assert.equal(state.step, previous.step + 1);
      for (const [id, commit] of Object.entries(previous.git.commits))
        assert.deepEqual(state.git.commits[id], commit);
    },
    commit(message = 'Snapshot') {
      this.command('git add .');
      this.command(`git commit -m "${message}"`);
    },
  };
}
export function completeRound(initial?: BoothSession) {
  const d = driver(initial);
  d.act({ type: 'intro/choose', choice: 'sara' });
  d.command('git init');
  d.next();
  d.commit('First');
  d.next();
  d.edit('event.txt', 'Event: Campus Code Day\nVenue: Auditorium\nTime: 10:00');
  d.command('git add event.txt');
  d.edit('event.txt', 'Event: Campus Code Day\nVenue: Library\nTime: 10:00');
  d.act({ type: 'prediction', value: 'Auditorium' });
  d.command('git commit -m "Staged"');
  d.next();
  d.command('git diff');
  d.commit();
  d.next();
  d.command('git switch -c venue');
  d.edit('event.txt', 'Event: Campus Code Day\nVenue: Auditorium\nTime: 10:00');
  d.commit();
  d.next();
  d.command('git switch main');
  d.edit('program.txt', '10:00 Welcome\n11:00 Git booth\n13:00 Workshop');
  d.commit();
  d.command('git merge venue');
  d.next();
  d.command('git switch -c time');
  d.edit('event.txt', 'Event: Campus Code Day\nVenue: Auditorium\nTime: 12:00');
  d.commit();
  d.next();
  d.command('git switch main');
  d.edit('event.txt', 'Event: Campus Code Day\nVenue: Auditorium\nTime: 14:00');
  d.commit();
  d.command('git merge time');
  d.next();
  d.command('git merge --abort');
  d.next();
  d.command('git merge time');
  d.next();
  d.edit('event.txt', 'Event: Campus Code Day\nVenue: Auditorium\nTime: 13:00');
  d.commit();
  d.next();
  d.command('git remote -v');
  d.command('git push');
  d.next();
  const beforeFetch = structuredClone(d.state.git.working);
  d.command('git fetch');
  assert.deepEqual(d.state.git.working, beforeFetch);
  d.next();
  d.command('git pull --ff-only');
  d.next();
  const program = d.state.git.working['program.txt'];
  d.edit('program.txt', program + '\n16:00 Wrong');
  d.commit();
  d.next();
  d.edit('program.txt', program + '\n16:00 Review');
  d.command('git add program.txt');
  d.command('git commit --amend -m "Review session"');
  d.next();
  d.command('git reset --soft HEAD~1');
  d.next();
  d.command('git commit -m "Reviewed schedule"');
  d.next();
  d.edit('event.txt', d.state.git.working['event.txt'].replace('Auditorium', 'Courtyard'));
  d.command('git add event.txt');
  d.command('git restore --staged event.txt');
  d.next();
  d.command('git restore event.txt');
  d.next();
  d.edit('program.txt', program + '\n16:00 Review\n17:00 Draft');
  d.command('git add program.txt');
  d.command('git stash push -m "Draft"');
  d.next();
  d.command('git switch venue');
  d.command('git switch main');
  d.command('git stash apply');
  d.next();
  d.command('git stash drop');
  d.commit();
  d.next();
  d.edit('program.txt', d.state.git.working['program.txt'] + '\n18:00 Demo');
  d.command('git stash');
  d.command('git stash pop');
  d.commit();
  d.next();
  const event = d.state.git.working['event.txt'];
  d.edit('event.txt', event.replace('Auditorium', 'Courtyard'));
  d.command('git stash');
  d.edit('event.txt', event.replace('Auditorium', 'Studio'));
  d.commit();
  d.command('git stash pop');
  d.next();
  d.edit('event.txt', event.replace('Auditorium', 'Courtyard'));
  d.commit();
  d.command('git stash drop');
  d.next();
  d.edit('event.txt', event.replace('Auditorium', 'Cancelled'));
  d.commit();
  d.command('git push');
  d.next();
  d.command('git revert HEAD');
  d.command('git push');
  d.next();
  d.edit('event.txt', d.state.git.working['event.txt'].replace('13:00', '14:00'));
  d.commit();
  d.act({ type: 'terminal/execute', command: 'git push' });
  assert.equal(d.state.transcript.at(-1)?.error, true);
  d.next();
  d.command('git fetch');
  d.act({ type: 'terminal/execute', command: 'git pull --ff-only' });
  assert.equal(d.state.transcript.at(-1)?.error, true);
  d.command('git merge origin/main');
  d.command('git push');
  d.next();
  return d.state;
}
test('all challenges form one continuous repository, including merge, conflict, push, fetch and pull', () => {
  const s = completeRound();
  assert.equal(challenges[s.step].id, 'finish');
  assert.equal(s.git.branches.main, s.git.remote?.branches.main);
  assert.ok(s.git.working['program.txt'].includes('Testing'));
  assert.equal(Object.values(s.git.commits).filter((c) => c.parents.length === 2).length, 3);
  assert.deepEqual(s.git.stashes, []);
  assert.deepEqual(s.git.stashConflicts, []);
});
test('30 complete rounds have isolated state; settings survive reset', () => {
  let s = boothReducer(createSession(), { type: 'preferences/toggle', key: 'reducedMotion' });
  for (let i = 0; i < 30; i++) {
    s = completeRound(s);
    s = boothReducer(s, { type: 'session/reset' });
    assert.equal(s.step, 0);
    assert.deepEqual(s.git.commits, {});
    assert.equal(s.git.remote, null);
    assert.deepEqual(s.git.stashes, []);
    assert.deepEqual(s.effects, []);
    assert.deepEqual(s.drafts, {});
    assert.deepEqual(s.commandHistory, []);
    assert.equal(s.group, i + 2);
    assert.equal(s.preferences.reducedMotion, true);
  }
});
test('next is gated; invalid commands cannot unlock it or mutate history', () => {
  const start = createSession();
  assert.equal(boothReducer(start, { type: 'wizard/next' }), start);
  const failed = boothReducer(start, { type: 'terminal/execute', command: 'git nonsense' });
  assert.deepEqual(failed.git, start.git);
  assert.deepEqual(failed.observed, []);
  assert.equal(stationComplete(failed), false);
});
test('retry restores only the current challenge checkpoint and removes drafts/evidence', () => {
  const d = driver();
  d.act({ type: 'intro/choose', choice: 'omar' });
  d.command('git init');
  d.next();
  const before = structuredClone(d.state.git);
  d.commit();
  d.act({ type: 'editor/draft', content: 'unwanted' });
  d.act({ type: 'wizard/retry' });
  assert.deepEqual(d.state.git, before);
  assert.deepEqual(d.state.drafts, {});
  assert.deepEqual(d.state.observed, []);
  assert.equal(d.state.step, 1);
  assert.equal(stationComplete(d.state), false);
});
test('drafts survive read-only commands, save does not stage, clear does not clear repository', () => {
  const d = driver();
  d.command('git init');
  d.act({ type: 'editor/draft', content: 'draft' });
  d.command('git status');
  assert.equal(d.state.drafts['event.txt'], 'draft');
  d.act({ type: 'editor/save' });
  assert.equal(d.state.git.working['event.txt'], 'draft');
  assert.deepEqual(d.state.git.index, {});
  const git = structuredClone(d.state.git);
  d.act({ type: 'terminal/execute', command: 'clear' });
  assert.deepEqual(d.state.git, git);
  assert.deepEqual(d.state.transcript, []);
});
