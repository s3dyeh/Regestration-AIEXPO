import { computed } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GitLearningStore } from './git-learning.store';
import { progressKey, restoreProgress } from './progress';

describe('GitLearningStore', () => {
  let store: GitLearningStore;

  beforeEach(() => {
    localStorage.removeItem(progressKey);
    TestBed.configureTestingModule({ providers: [GitLearningStore] });
    store = TestBed.inject(GitLearningStore);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.removeItem(progressKey);
  });

  it('derives completion synchronously and only advances after the required outcomes', () => {
    expect(store.complete()).toBeFalse();
    store.dispatch({ type: 'wizard/next' });
    expect(store.challenge().id).toBe('problem');
    store.dispatch({ type: 'intro/choose', choice: 'sara' });
    store.dispatch({ type: 'terminal/execute', command: 'git init' });
    expect(store.complete()).toBeTrue();
    store.dispatch({ type: 'wizard/next' });
    expect(store.challenge().id).toBe('first');
    expect(store.complete()).toBeFalse();
  });

  it('keeps drafts separate from saved files and does not invalidate checkpoint consumers on typing', () => {
    let checkpointReads = 0;
    const checkpoint = computed(() => {
      checkpointReads++;
      return store.checkpoint();
    });
    const original = store.git().working['event.txt'];
    checkpoint();
    store.dispatch({ type: 'editor/draft', content: 'Student draft' });
    expect(store.editorContent()).toBe('Student draft');
    expect(store.editorDirty()).toBeTrue();
    expect(store.git().working['event.txt']).toBe(original);
    checkpoint();
    expect(checkpointReads).toBe(1);
    store.dispatch({ type: 'editor/save' });
    expect(store.git().working['event.txt']).toBe('Student draft');
    expect(store.editorDirty()).toBeFalse();
    expect(store.head()['event.txt']).toBeUndefined();
  });

  it('flushes pending progress on route destruction and restores it in a new store', () => {
    store.dispatch({ type: 'editor/draft', content: 'Survives navigation' });
    TestBed.resetTestingModule();
    const saved = restoreProgress(localStorage.getItem(progressKey));
    expect(saved.session.drafts['event.txt']).toBe('Survives navigation');
    TestBed.configureTestingModule({ providers: [GitLearningStore] });
    expect(TestBed.inject(GitLearningStore).editorContent()).toBe('Survives navigation');
  });
});
