import { of, throwError } from 'rxjs';
import { inspectQuality, selectQualityFiles } from './github-quality';
import type { GithubRequest } from './github-quality';

describe('GitHub evidence collection', () => {
  it('samples deterministically across paths and excludes generated and test code', () => {
    const paths = [
      'src/z.ts',
      'src/a.ts',
      'src/m.ts',
      'src/n.ts',
      'src/api.test.ts',
      'vendor/lib.ts',
      'generated/client.ts',
      'src/types.d.ts',
      'README.md',
      'docs/c.md',
      'docs/a.md',
      'docs/b.md',
    ];
    const selection = selectQualityFiles(paths);
    expect(selection).toEqual(selectQualityFiles([...paths].reverse()));
    expect(selection.sourceCandidates).toBe(4);
    expect(selection.sources).toEqual(['src/a.ts', 'src/n.ts', 'src/z.ts']);
    expect(selection.documents).toEqual(['docs/a.md', 'docs/c.md']);
  });
  it('returns no invented sample for an empty repository', () => {
    expect(selectQualityFiles([]).sources).toEqual([]);
    expect(selectQualityFiles([]).documents).toEqual([]);
  });
  it('collects workflow outcomes separately from configuration evidence', () => {
    const requested: string[] = [];
    const request: GithubRequest = <T>(path: string) => {
      requested.push(path);
      const response = path.includes('/commits?')
        ? []
        : {
            workflow_runs: [
              {
                id: 1,
                workflow_id: 7,
                status: 'completed',
                conclusion: 'failure',
                html_url: 'https://github.com/student/api/actions/runs/1',
              },
            ],
          };
      return of(response as T);
    };
    let observed = false;
    inspectQuality(
      request,
      'student',
      'api',
      'feature/branch',
      ['.github/workflows/ci.yml'],
      true,
      new AbortController().signal,
    ).subscribe((result) => {
      observed = true;
      const checks = result.categories.flatMap((category) => category.checks);
      expect(checks.find((check) => check.label === 'CI configuration')?.value).toBe(1);
      expect(checks.find((check) => check.label === 'Observed workflow outcomes')?.value).toBe(0);
      expect(result.sampleScope.workflowRuns).toBe(1);
    });
    expect(observed).toBeTrue();
    expect(requested[1]).toContain('branch=feature%2Fbranch');
  });
  it('does not interpret oversized content or failed history as an empty file/history', () => {
    const request: GithubRequest = <T>(path: string) =>
      path.includes('/commits?')
        ? throwError(() => new Error('Unavailable'))
        : of({ encoding: 'base64', content: '', size: 100001 } as T);
    let observed = false;
    inspectQuality(
      request,
      'student',
      'api',
      'main',
      ['README.md'],
      true,
      new AbortController().signal,
    ).subscribe((result) => {
      observed = true;
      expect(result.sampledFiles[0].assessed).toBeFalse();
      expect(result.categories[0].checks.every((check) => check.value === null)).toBeTrue();
      expect(result.commitCount).toBeNull();
      expect(result.issues.length).toBe(2);
    });
    expect(observed).toBeTrue();
  });
});
