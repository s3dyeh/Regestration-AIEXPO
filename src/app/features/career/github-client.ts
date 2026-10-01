import { defer, from, map, of, switchMap } from 'rxjs';
import type { Observable } from 'rxjs';
interface CachedResponse {
  expires: number;
  data: unknown;
}
export class GithubRateLimitError extends Error {
  constructor(readonly retryAt: number) {
    super(
      `GitHub rate limit reached. Retry after ${new Date(retryAt).toLocaleString()} (your local time), or add a GitHub token below for authenticated access. Successful requests are cached for 5 minutes.`,
    );
  }
}
export function rateLimitRetryAt(
  response: Response,
  message: string,
  now = Date.now(),
): number | null {
  if (response.status !== 403 && response.status !== 429) return null;
  const remaining = response.headers.get('x-ratelimit-remaining');
  const retry = response.headers.get('retry-after');
  const limited =
    response.status === 429 ||
    remaining === '0' ||
    retry !== null ||
    /rate limit|secondary rate|abuse detection/i.test(message);
  if (!limited) return null;
  const retrySeconds =
    retry !== null && /^\d+(\.\d+)?$/.test(retry)
      ? Number(retry) * 1000 + now
      : Date.parse(retry ?? '');
  const reset = Number(response.headers.get('x-ratelimit-reset')) * 1000;
  return Math.max(
    now + 60_000,
    Number.isFinite(retrySeconds) ? retrySeconds : 0,
    remaining === '0' && Number.isFinite(reset) ? reset + 1000 : 0,
  );
}
/** Page-session client: no credentials or API data are written to persistent browser storage. */
export class GithubClient {
  private readonly cache = new Map<string, CachedResponse>();
  private retryAt = 0;
  private invalidCredentials = false;
  constructor(private readonly token = '') {}
  request<T>(path: string, signal: AbortSignal): Observable<T> {
    return defer(() => {
      if (signal.aborted) throw new DOMException('Request aborted', 'AbortError');
      const cached = this.cache.get(path);
      if (cached && cached.expires > Date.now()) return of(structuredClone(cached.data) as T);
      if (this.retryAt > Date.now()) throw new GithubRateLimitError(this.retryAt);
      if (this.invalidCredentials)
        throw new Error('GitHub rejected this token. Replace it or clear it to use public access.');
      const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
      if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
      return from(
        fetch(`https://api.github.com${path}`, {
          signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
          headers,
        }),
      ).pipe(
        switchMap((response) =>
          from(response.json().catch(() => ({})) as Promise<unknown>).pipe(
            map((data) => {
              if (!response.ok) {
                const message =
                  data &&
                  typeof data === 'object' &&
                  'message' in data &&
                  typeof data.message === 'string'
                    ? data.message
                    : '';
                const retryAt = rateLimitRetryAt(response, message);
                if (retryAt !== null) {
                  this.retryAt = retryAt;
                  throw new GithubRateLimitError(retryAt);
                }
                if (response.status === 401) {
                  this.invalidCredentials = true;
                  throw new Error(
                    'GitHub rejected this token. Replace it or clear it to use public access.',
                  );
                }
                if (response.status === 403)
                  throw new Error(
                    'GitHub denied access to this resource. Check repository visibility or token permissions. Other available evidence can still be inspected.',
                  );
                if (response.status === 404)
                  throw new Error(
                    'GitHub profile or repository not found. Check the username and make sure it is public.',
                  );
                throw new Error(
                  `GitHub could not complete this request (${response.status}). Please retry.`,
                );
              }
              // Only successful responses are cached; partial analysis can resume missing requests.
              if (this.cache.size >= 80) this.cache.delete(this.cache.keys().next().value!);
              this.cache.set(path, { data: structuredClone(data), expires: Date.now() + 300_000 });
              return data as T;
            }),
          ),
        ),
      );
    });
  }
  clear(): void {
    this.cache.clear();
  }
}
