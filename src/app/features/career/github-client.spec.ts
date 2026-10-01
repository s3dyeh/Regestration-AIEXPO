import { GithubClient, GithubRateLimitError, rateLimitRetryAt } from './github-client';
import { firstValueFrom } from 'rxjs';

describe('GitHub request limits and caching', () => {
  it('distinguishes permission denial from a rate limit', () => {
    expect(
      rateLimitRetryAt(
        new Response('', { status: 403 }),
        'Resource not accessible by integration',
        1000,
      ),
    ).toBeNull();
    expect(
      rateLimitRetryAt(
        new Response('', {
          status: 403,
          headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '200' },
        }),
        '',
        1000,
      ),
    ).toBe(201000);
    expect(
      rateLimitRetryAt(
        new Response('', { status: 429, headers: { 'retry-after': '120' } }),
        '',
        1000,
      ),
    ).toBe(121000);
    expect(
      rateLimitRetryAt(new Response('', { status: 403 }), 'API rate limit exceeded', 1000),
    ).toBe(61000);
  });
  it('reuses successful responses without another request or sharing mutable results', () => {
    const fetchSpy = spyOn(globalThis, 'fetch').and.resolveTo(
      new Response(JSON.stringify({ value: 1 })),
    );
    const client = new GithubClient();
    const signal = new AbortController().signal;
    return firstValueFrom(client.request<{ value: number }>('/users/student', signal))
      .then((first) => {
        first.value = 2;
        return firstValueFrom(client.request<{ value: number }>('/users/student', signal));
      })
      .then((second) => {
        expect(second.value).toBe(1);
        expect(fetchSpy).toHaveBeenCalledTimes(1);
      });
  });
  it('blocks repeated network attempts until the advertised reset', () => {
    const fetchSpy = spyOn(globalThis, 'fetch').and.resolveTo(
      new Response(JSON.stringify({ message: 'API rate limit exceeded' }), {
        status: 403,
        headers: {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
        },
      }),
    );
    const client = new GithubClient();
    const signal = new AbortController().signal;
    return firstValueFrom(client.request('/users/student', signal))
      .catch((error: unknown) => {
        expect(error instanceof GithubRateLimitError).toBeTrue();
        return firstValueFrom(client.request('/users/other', signal));
      })
      .then(
        () => fail('Expected a rate limit'),
        (error: unknown) => {
          expect(error instanceof GithubRateLimitError).toBeTrue();
          expect(fetchSpy).toHaveBeenCalledTimes(1);
        },
      );
  });
  it('continues after a permission denial and does not cache failures', () => {
    const fetchSpy = spyOn(globalThis, 'fetch').and.returnValues(
      Promise.resolve(new Response('{}', { status: 403 })),
      Promise.resolve(new Response('[]')),
    );
    const client = new GithubClient();
    const signal = new AbortController().signal;
    return firstValueFrom(client.request('/repos/student/demo/contents/README.md', signal))
      .catch(() => firstValueFrom(client.request('/repos/student/demo/commits', signal)))
      .then((result) => {
        expect(result).toEqual([]);
        expect(fetchSpy).toHaveBeenCalledTimes(2);
      });
  });
});
