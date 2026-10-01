import test from 'node:test';
import assert from 'node:assert/strict';
import { boothReducer, createSession, stationComplete } from '../../../src/app/features/git-learning/state/session';
import { challenges } from '../../../src/app/features/git-learning/curriculum/challenges';

test('one-click remaining actions finish all 30 challenges without checkpoint resets', () => {
  let s = createSession();
  for (const challenge of challenges.slice(0, -1)) {
    const checkpoint = s.checkpoint;
    let clicks = 0;
    while (!stationComplete(s) && clicks++ < 25) {
      const commits = structuredClone(s.git.commits);
      s = boothReducer(s, { type: 'solution/next' });
      assert.equal(s.checkpoint, checkpoint);
      for (const [id, commit] of Object.entries(commits))
        assert.deepEqual(s.git.commits[id], commit);
    }
    assert.ok(stationComplete(s), challenge.id + ': ' + s.explanation);
    assert.equal(boothReducer(s, { type: 'solution/next' }), s);
    s = boothReducer(s, { type: 'wizard/next' });
  }
  assert.equal(challenges[s.step].id, 'finish');
});
test('skips completed manual actions and preserves staged data, drafts and custom commit messages', () => {
  let s = createSession();
  s = boothReducer(s, { type: 'intro/choose', choice: 'omar' });
  s = boothReducer(s, { type: 'solution/next' });
  assert.equal(s.introChoice, 'omar');
  assert.equal(s.git.initialized, true);
  s = boothReducer(s, { type: 'wizard/next' });
  s = boothReducer(s, {
    type: 'editor/draft',
    content: s.git.working['event.txt'] + '\nStudent note: keep me',
  });
  s = boothReducer(s, { type: 'solution/next' });
  assert.match(s.git.working['event.txt'], /keep me/);
  assert.deepEqual(s.git.index, {});
  s = boothReducer(s, { type: 'terminal/execute', command: 'git add .' });
  const history = s.commandHistory.length;
  s = boothReducer(s, { type: 'solution/next' });
  assert.equal(s.commandHistory.length, history + 1);
  assert.match(s.commandHistory.at(-1)!, /git commit/);
  assert.match(s.git.commits[s.git.branches.main!].tree['event.txt'], /keep me/);
  s = boothReducer(s, { type: 'wizard/next' });
  s = boothReducer(s, {
    type: 'editor/draft',
    content: s.git.working['event.txt'].replace('Room A', 'Auditorium'),
  });
  s = boothReducer(s, { type: 'editor/save' });
  s = boothReducer(s, { type: 'terminal/execute', command: 'git add event.txt' });
  const staged = s.git.index['event.txt'];
  s = boothReducer(s, { type: 'solution/next' });
  assert.equal(s.git.index['event.txt'], staged);
  assert.match(s.drafts['event.txt'], /Library/);
  assert.match(s.drafts['event.txt'], /keep me/);
});
