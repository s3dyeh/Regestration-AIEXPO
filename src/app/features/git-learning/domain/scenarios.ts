import { resetSession, execute, editFile, copy, tip, type GitState } from './engine';
export type ScenarioId =
  | 'intro'
  | 'snapshot'
  | 'branches'
  | 'remote'
  | 'github'
  | 'quiz'
  | 'conflict'
  | 'fetch'
  | 'internals'
  | 'clone';
export const initialFiles = {
  'event.txt': 'Event: Campus Code Day\nVenue: Room A\nTime: 10:00',
  'program.txt': '10:00 Welcome\n11:00 Git booth',
};
const run = (s: GitState, command: string) => {
  const r = execute(command, s);
  if (r.error) throw new Error(r.error);
  return r.state;
};
export function baseRepository(): GitState {
  let s = resetSession();
  s.working = copy(initialFiles);
  s = run(s, 'git init');
  s = run(s, 'git add .');
  return run(s, 'git commit -m "Plan campus event"');
}
function commitEdit(s: GitState, file: string, content: string, message: string) {
  s = editFile(s, file, content);
  s = run(s, `git add ${file}`);
  return run(s, `git commit -m "${message}"`);
}
export function loadScenario(id: ScenarioId): GitState {
  if (id === 'intro') {
    const s = resetSession();
    s.working = copy(initialFiles);
    return s;
  }
  let s = baseRepository();
  if (id === 'snapshot')
    return editFile(s, 'event.txt', initialFiles['event.txt'].replace('Room A', 'Auditorium'));
  if (id === 'branches' || id === 'conflict') {
    s = run(s, 'git switch -c venue');
    s = commitEdit(
      s,
      'event.txt',
      initialFiles['event.txt'].replace('Room A', 'Auditorium'),
      'Move to auditorium',
    );
    s = run(s, 'git switch main');
    s = commitEdit(
      s,
      id === 'conflict' ? 'event.txt' : 'program.txt',
      id === 'conflict'
        ? initialFiles['event.txt'].replace('Room A', 'Library')
        : initialFiles['program.txt'] + '\n12:00 Open source stories',
      id === 'conflict' ? 'Choose library' : 'Add open source session',
    );
    return s;
  }
  if (id === 'remote' || id === 'github' || id === 'fetch' || id === 'clone') {
    s.remote = { commits: copy(s.commits), branches: copy(s.branches) };
    s.tracking = copy(s.branches);
    if (id === 'remote')
      s = commitEdit(
        s,
        'event.txt',
        initialFiles['event.txt'].replace('Room A', 'Auditorium'),
        'Confirm venue',
      );
    if (id === 'github') {
      s = run(s, 'git switch -c venue');
      s = commitEdit(
        s,
        'event.txt',
        initialFiles['event.txt'].replace('Room A', 'Auditorium'),
        'Move to auditorium',
      );
    }
    if (id === 'fetch') {
      s.remote!.commits['r001'] = {
        id: 'r001',
        parents: [tip(s)!],
        message: 'Teammate updates schedule',
        author: 'Remote teammate',
        tree: {
          ...copy(initialFiles),
          'program.txt': '10:00 Welcome\n11:00 Git booth\n12:00 Team challenge',
        },
      };
      s.remote!.branches['main'] = 'r001';
    }
  }
  return s;
}
