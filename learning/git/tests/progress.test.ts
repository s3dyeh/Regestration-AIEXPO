import test from 'node:test';
import assert from 'node:assert/strict';
import {
  learningReducer,
  restoreProgress,
  serializeProgress,
} from '../../../src/app/features/git-learning/state/progress';

test('reload preserves challenge, draft, staged state, history and preferences', () => {
  let state = restoreProgress(null);
  state = learningReducer(state, { type: 'intro/choose', choice: 'sara' });
  state = learningReducer(state, { type: 'terminal/execute', command: 'git init' });
  state = learningReducer(state, { type: 'wizard/next' });
  state = learningReducer(state, { type: 'terminal/execute', command: 'git add .' });
  state = learningReducer(state, { type: 'editor/draft', content: 'a' });
  state = learningReducer(state, { type: 'editor/draft', content: 'a draft to keep' });
  state = learningReducer(state, { type: 'preferences/toggle', key: 'projection' });
  assert.equal(state.journal.actions.filter((a) => a.type === 'editor/draft').length, 1);
  assert.deepEqual(restoreProgress(serializeProgress(state.journal)).session, state.session);
});
test('reset clears previous work and retains settings on reload', () => {
  let state = learningReducer(restoreProgress(null), {
    type: 'preferences/toggle',
    key: 'reducedMotion',
  });
  state = learningReducer(state, { type: 'terminal/execute', command: 'git init' });
  state = learningReducer(state, { type: 'session/reset' });
  assert.equal(state.journal.actions.length, 0);
  const restored = restoreProgress(serializeProgress(state.journal));
  assert.equal(restored.session.git.initialized, false);
  assert.equal(restored.session.group, 2);
  assert.equal(restored.session.preferences.reducedMotion, true);
});
test('invalid and unknown saved formats recover instead of crashing', () => {
  for (const raw of [
    'bad json',
    '{}',
    JSON.stringify({ version: 2 }),
    JSON.stringify({ ...restoreProgress(null).journal, actions: [{ type: 'run-arbitrary-code' }] }),
  ]) {
    const state = restoreProgress(raw);
    assert.equal(state.recovered, true);
    assert.equal(state.session.step, 0);
  }
});
