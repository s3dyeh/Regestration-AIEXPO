/** Deliberately bounded educational Git model. No operating-system commands run here. */
export type Files = Record<string, string>;
export interface Commit {
  id: string;
  parents: string[];
  tree: Files;
  message: string;
  author: string;
}
export interface Repository {
  commits: Record<string, Commit>;
  branches: Record<string, string | null>;
}
export interface GitState extends Repository {
  initialized: boolean;
  head: string;
  working: Files;
  index: Files;
  nextId: number;
  remote: Repository | null;
  tracking: Record<string, string | null>;
  merging: { parent: string; branch: string; unresolved: string[] } | null;
  stashes: StashEntry[];
  nextStashId: number;
  stashConflicts: string[];
}
export interface StashEntry {
  id: string;
  base: string;
  branch: string;
  message: string;
  working: Files;
  index: Files;
}
export interface Event {
  kind: string;
  text: string;
}
export interface Result {
  state: GitState;
  output: string;
  events: Event[];
  error?: string;
}
export const copy = <T>(x: T): T => structuredClone(x);
export const same = (a: Files, b: Files) => Object.keys({ ...a, ...b }).every((k) => a[k] === b[k]);
export const tip = (s: GitState) => s.branches[s.head] ?? null;
export const headTree = (s: GitState): Files => (tip(s) ? s.commits[tip(s)!].tree : {});
export const changed = (a: Files, b: Files) =>
  Object.keys({ ...a, ...b }).filter((k) => a[k] !== b[k]);
export const clean = (s: GitState) => same(s.working, s.index) && same(s.index, headTree(s));
export function resetSession(): GitState {
  return {
    initialized: false,
    head: 'main',
    branches: { main: null },
    commits: {},
    working: {},
    index: {},
    nextId: 1,
    remote: null,
    tracking: {},
    merging: null,
    stashes: [],
    nextStashId: 1,
    stashConflicts: [],
  };
}
export function editFile(s: GitState, path: string, content: string): GitState {
  const n = copy(s);
  n.working[path] = content;
  return n;
}
export function isAncestor(
  repo: Repository,
  ancestor: string | null,
  descendant: string | null,
): boolean {
  if (!ancestor) return true;
  const seen = new Set<string>(),
    pending = descendant ? [descendant] : [];
  while (pending.length) {
    const id = pending.pop()!;
    if (id === ancestor) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    pending.push(...(repo.commits[id]?.parents ?? []));
  }
  return false;
}
export function ancestorDistances(s: GitState, start: string): Map<string, number> {
  const distances = new Map<string, number>(),
    queue: [string, number][] = [[start, 0]];
  for (let i = 0; i < queue.length; i++) {
    const [id, d] = queue[i];
    if (distances.has(id)) continue;
    distances.set(id, d);
    for (const p of s.commits[id]?.parents ?? []) queue.push([p, d + 1]);
  }
  return distances;
}
export function mergeBase(s: GitState, a: string, b: string): string | null {
  const da = ancestorDistances(s, a),
    db = ancestorDistances(s, b);
  const common = [...da.keys()].filter((k) => db.has(k));
  // Discard older common ancestors before choosing the nearest. Criss-cross is outside this lab.
  const best = common.filter((k) => !common.some((j) => j !== k && isAncestor(s, k, j)));
  return best.sort((x, y) => da.get(x)! + db.get(x)! - da.get(y)! - db.get(y)!)[0] ?? null;
}
export function createCommit(
  s: GitState,
  message: string,
  parents: string[],
  author = 'Booth student',
) {
  let id: string;
  do {
    id = `c${String(s.nextId++).padStart(3, '0')}`;
  } while (s.commits[id] || s.remote?.commits[id]);
  s.commits[id] = { id, message, parents, author, tree: copy(s.index) };
  s.branches[s.head] = id;
  return id;
}
export function diff(a: Files, b: Files): string {
  return (
    changed(a, b)
      .map(
        (k) =>
          `diff -- ${k}\n--- before\n+++ after\n${
            a[k] === undefined
              ? ''
              : a[k]
                  .split('\n')
                  .map((l) => '- ' + l)
                  .join('\n')
          }\n${
            b[k] === undefined
              ? ''
              : b[k]
                  .split('\n')
                  .map((l) => '+ ' + l)
                  .join('\n')
          }`,
      )
      .join('\n\n') || 'No differences.'
  );
}
