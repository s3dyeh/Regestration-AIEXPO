import { GithubClient } from './github-client';
import type { TechnologyEvidence } from './career-path';
import { inspectQuality } from './github-quality';
import type { ScoreCategory } from './github-score';
import { catchError, concatMap, from, map, of, switchMap, toArray } from 'rxjs';
import type { Observable } from 'rxjs';
export interface RepositoryEvidence {
  name: string;
  url: string;
  description: string;
  language: string | null;
  skills: string[];
  signals: string[];
  files: { path: string; url: string }[];
  inspected: boolean;
  limitation: string;
  categories: ScoreCategory[];
  sampledFiles: { path: string; url: string; assessed: boolean }[];
  technologyEvidence?: TechnologyEvidence[];
  commitCount: number | null;
  sampleScope: {
    sourceCandidates: number;
    documentCandidates: number;
    sourceSelected: number;
    documentSelected: number;
    treeComplete: boolean;
    workflowRuns: number | null;
  };
}
export interface GithubReport {
  username: string;
  repositories: RepositoryEvidence[];
  totalPublic: number;
  analyzedAt: string;
  selection: { fetched: number; eligible: number; selected: number; limit: number };
}

export function githubUsername(value: string): string {
  const input = value.trim();
  let username = input;
  if (/^(https?:\/\/|www\.|github\.com\/)/i.test(input)) {
    const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    if (url.hostname.toLowerCase() !== 'github.com' || url.search || url.hash)
      throw new Error('Enter a github.com profile URL or username.');
    username = url.pathname.replace(/^\/|\/$/g, '');
  }
  if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(username) || username.includes('--'))
    throw new Error('Enter a valid GitHub username or profile URL, not a repository URL.');
  return username;
}

export function detectEvidence(
  paths: string[],
  language: string | null,
): { skills: string[]; signals: string[]; paths: string[] } {
  const skills = new Set<string>(language ? [language] : []);
  const signals = new Set<string>();
  const evidence = new Set<string>();
  const rules: [RegExp, string, 'skill' | 'signal'][] = [
    [
      /(^|\/)Dockerfile(?:\.[^/]+)?$|(^|\/)compose\.ya?ml$|(^|\/)docker-compose[^/]*\.ya?ml$/i,
      'Docker',
      'skill',
    ],
    [/(^|\/)tsconfig[^/]*\.json$/i, 'TypeScript', 'skill'],
    [/(^|\/)angular\.json$/i, 'Angular', 'skill'],
    [/(^|\/)next\.config\.[cm]?[jt]s$/i, 'Next.js', 'skill'],
    [/(^|\/)requirements\.txt$|(^|\/)pyproject\.toml$/i, 'Python', 'skill'],
    [/(^|\/)go\.mod$/, 'Go', 'skill'],
    [/(^|\/)Cargo\.toml$/, 'Rust', 'skill'],
    [/(^|\/)README(?:\.[^/]+)?$/i, 'README', 'signal'],
    [/\.github\/workflows\/[^/]+\.ya?ml$/i, 'CI configuration', 'signal'],
    [
      /(^|\/)(__tests__|tests?)\/|\.(spec|test)\.[cm]?[jt]sx?$|(^|\/)test_[^/]+\.py$/i,
      'Test files',
      'signal',
    ],
    [/(^|\/)(LICENSE|LICENCE)(\.[^/]+)?$/i, 'License', 'signal'],
    [/(^|\/)\.env\.example$/i, 'Environment example', 'signal'],
  ];
  for (const path of paths)
    for (const [pattern, name, kind] of rules)
      if (pattern.test(path)) {
        (kind === 'skill' ? skills : signals).add(name);
        evidence.add(path);
      }
  return { skills: [...skills], signals: [...signals], paths: [...evidence] };
}

interface Repo {
  name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  fork: boolean;
  archived: boolean;
  default_branch: string;
}
export function analyzeGithub(
  username: string,
  signal: AbortSignal,
  progress: (message: string) => void,
  client = new GithubClient(),
): Observable<GithubReport> {
  const request = <T>(path: string): Observable<T> => client.request<T>(path, signal);
  progress('Finding public repositories…');
  return request<{ login: string; public_repos: number }>(`/users/${username}`).pipe(
    switchMap((user) =>
      request<Repo[]>(`/users/${username}/repos?sort=pushed&per_page=100&type=owner`).pipe(
        switchMap((repos) => {
          const eligible = repos.filter(
            (repo) =>
              !repo.fork && !repo.archived && repo.name.toLowerCase() !== user.login.toLowerCase(),
          );
          const selected = eligible.slice(0, 6);
          return from(selected).pipe(
            concatMap((repo, index) => {
              progress(`Inspecting ${repo.name} (${index + 1} of ${selected.length})…`);
              return request<{ tree: { path: string; type: string }[]; truncated: boolean }>(
                `/repos/${username}/${encodeURIComponent(repo.name)}/git/trees/${encodeURIComponent(repo.default_branch)}?recursive=1`,
              ).pipe(
                map((tree) => ({
                  paths: tree.tree
                    .filter(
                      (file) =>
                        file.type === 'blob' &&
                        !/(^|\/)(node_modules|vendor|dist|build|generated|coverage)\//.test(
                          file.path,
                        ),
                    )
                    .map((file) => file.path),
                  inspected: true,
                  limitation: tree.truncated
                    ? 'GitHub returned a partial file tree. Some evidence may be missing.'
                    : '',
                })),
                catchError((error: unknown) => {
                  if (signal.aborted) throw error;
                  return of({
                    paths: [] as string[],
                    inspected: false,
                    limitation:
                      error instanceof Error
                        ? error.message
                        : 'Repository files could not be inspected.',
                  });
                }),
                switchMap((result) => {
                  const detected = detectEvidence(result.paths, repo.language);
                  return inspectQuality(
                    request,
                    username,
                    repo.name,
                    repo.default_branch,
                    result.paths,
                    result.inspected && !result.limitation,
                    signal,
                  ).pipe(
                    map((quality) => ({
                      ...quality,
                      name: repo.name,
                      url: `https://github.com/${username}/${encodeURIComponent(repo.name)}`,
                      description: repo.description || 'No repository description provided.',
                      language: repo.language,
                      skills: detected.skills,
                      signals: detected.signals,
                      inspected: result.inspected,
                      limitation: [result.limitation, ...quality.issues].filter(Boolean).join(' '),
                      files: detected.paths.map((path) => ({
                        path,
                        url: `https://github.com/${username}/${encodeURIComponent(repo.name)}/blob/${encodeURIComponent(repo.default_branch)}/${path.split('/').map(encodeURIComponent).join('/')}`,
                      })),
                    })),
                  );
                }),
              );
            }),
            toArray(),
            map((repositories) => ({
              repositories,
              selection: {
                fetched: repos.length,
                eligible: eligible.length,
                selected: selected.length,
                limit: 6,
              },
            })),
          );
        }),
        map((result) => ({
          username: user.login,
          ...result,
          totalPublic: user.public_repos,
          analyzedAt: new Date().toISOString(),
        })),
      ),
    ),
  );
}
