import { detectTechnologyImports } from './career-path';
import { catchError, concatMap, from, map, of, switchMap, toArray } from 'rxjs';
import type { Observable } from 'rxjs';
import { scoreRepository } from './github-score';
import type { CommitSample, ContentSample, WorkflowSample } from './github-score';
export type GithubRequest = <T>(path: string) => Observable<T>;
interface ContentResponse {
  encoding: string;
  content: string;
  size: number;
}
interface CommitResponse {
  sha: string;
  parents?: { sha: string }[];
  commit: { message: string; author: { date: string } | null };
}
interface WorkflowResponse {
  workflow_runs: {
    id: number;
    workflow_id: number;
    status: string;
    conclusion: string | null;
    html_url: string;
  }[];
}
export function selectQualityFiles(paths: string[]) {
  const readme = paths.find((path) => /^readme(?:\.[^/]+)?$/i.test(path));
  const documents = paths
    .filter((path) =>
      /(^docs?\/.*\.(md|rst|txt)$|(^|\/)(CONTRIBUTING|ARCHITECTURE|DEVELOPMENT|TESTING)\.md$)/i.test(
        path,
      ),
    )
    .sort();
  const candidates = paths
    .filter(
      (path) =>
        /\.(ts|tsx|js|jsx|py|go|rs|java|cs|rb|c|cpp|h|hpp|kt|swift|php|scala|vue|svelte)$/i.test(
          path,
        ) &&
        !/(^|\/)(vendor|node_modules|dist|build|generated|coverage|__tests__|tests?|spec)\/|\.min\.|\.d\.ts$|\.(test|spec)\.|(^|\/)test_|_test\.go$|Test\.java$|Tests?\.cs$/i.test(
          path,
        ),
    )
    .sort();
  // Deterministic spread across the path list; does not imply a random or representative sample.
  const spread = (items: string[], count: number) => [
    ...new Set(
      Array.from(
        { length: Math.min(count, items.length) },
        (_, index) =>
          items[
            Math.round(
              (index * (items.length - 1)) / Math.max(1, Math.min(count, items.length) - 1),
            )
          ],
      ),
    ),
  ];
  return {
    readme,
    documents: spread(documents, 2),
    sources: spread(candidates, 3),
    sourceCandidates: candidates.length,
    documentCandidates: documents.length,
  };
}
export function inspectQuality(
  request: GithubRequest,
  username: string,
  repo: string,
  branch: string,
  paths: string[],
  completeTree: boolean,
  signal: AbortSignal,
) {
  const base = `/repos/${username}/${encodeURIComponent(repo)}`;
  const url = `https://github.com/${username}/${encodeURIComponent(repo)}`;
  const issues: string[] = [];
  const selection = selectQualityFiles(paths);
  const files = [selection.readme, ...selection.documents, ...selection.sources].filter(
    (path): path is string => Boolean(path),
  );
  const content = (path: string): Observable<ContentSample> => {
    const fileUrl = `${url}/blob/${encodeURIComponent(branch)}/${path.split('/').map(encodeURIComponent).join('/')}`;
    return request<ContentResponse>(
      `${base}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(branch)}`,
    ).pipe(
      map((response) => {
        if (
          response.encoding !== 'base64' ||
          typeof response.content !== 'string' ||
          response.size > 100_000
        )
          throw new Error('Content unavailable or exceeds the 100 KB inspection limit.');
        const bytes = Uint8Array.from(atob(response.content.replace(/\s/g, '')), (char) =>
          char.charCodeAt(0),
        );
        return {
          path,
          text: new TextDecoder('utf-8', { fatal: true }).decode(bytes),
          url: fileUrl,
        };
      }),
      catchError((error: unknown) => {
        if (signal.aborted) throw error;
        issues.push(`${path}: ${error instanceof Error ? error.message : 'Content unavailable.'}`);
        return of({ path, text: null, url: fileUrl });
      }),
    );
  };
  const history = () =>
    request<CommitResponse[]>(
      `${base}/commits?author=${encodeURIComponent(username)}&sha=${encodeURIComponent(branch)}&per_page=30`,
    ).pipe(
      map((items): CommitSample[] | null =>
        items.map((item) => ({
          message: item.commit.message,
          date: item.commit.author?.date ?? '',
          url: `${url}/commit/${encodeURIComponent(item.sha)}`,
          merge: (item.parents?.length ?? 0) > 1,
        })),
      ),
      catchError((error: unknown) => {
        if (signal.aborted) throw error;
        issues.push(`Commits: ${error instanceof Error ? error.message : 'History unavailable.'}`);
        return of(null);
      }),
    );
  const workflows = (): Observable<WorkflowSample[] | null> => {
    if (!paths.some((path) => /^\.github\/workflows\/[^/]+\.ya?ml$/i.test(path))) return of(null);
    return request<WorkflowResponse>(
      `${base}/actions/runs?branch=${encodeURIComponent(branch)}&per_page=10`,
    ).pipe(
      map((response) =>
        response.workflow_runs.map((run) => ({
          id: run.id,
          workflowId: run.workflow_id,
          status: run.status,
          conclusion: run.conclusion,
          url: run.html_url,
        })),
      ),
      catchError((error: unknown) => {
        if (signal.aborted) throw error;
        issues.push(
          `Workflow outcomes: ${error instanceof Error ? error.message : 'Unavailable.'}`,
        );
        return of(null);
      }),
    );
  };
  return from(files).pipe(
    concatMap(content),
    toArray(),
    switchMap((samples) =>
      history().pipe(
        switchMap((commits) =>
          workflows().pipe(
            map((runs) => ({
              categories: scoreRepository({
                paths,
                completeTree,
                url,
                commits,
                workflows: runs,
                readme: samples.find((sample) => sample.path === selection.readme) ?? null,
                documentation: null,
                documents: samples.filter((sample) => selection.documents.includes(sample.path)),
                sources: samples.filter((sample) => selection.sources.includes(sample.path)),
              }),
              technologyEvidence: detectTechnologyImports(
                samples.filter((sample) => selection.sources.includes(sample.path)),
              ),
              sampledFiles: samples.map(({ path, url, text }) => ({
                path,
                url,
                assessed: text !== null,
              })),
              commitCount: commits?.length ?? null,
              sampleScope: {
                sourceCandidates: selection.sourceCandidates,
                documentCandidates: selection.documentCandidates,
                sourceSelected: selection.sources.length,
                documentSelected: selection.documents.length,
                treeComplete: completeTree,
                workflowRuns: runs?.length ?? null,
              },
              issues,
            })),
          ),
        ),
      ),
    ),
  );
}
