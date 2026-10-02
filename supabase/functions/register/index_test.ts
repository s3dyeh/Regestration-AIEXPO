import assert from 'node:assert/strict';
import { handleAttendance } from './index.ts';

Deno.test('attendance requires a valid operator JWT and uses it for check-in', async () => {
  const originalFetch = globalThis.fetch;
  const values = {
    ALLOWED_ORIGINS: 'https://expo.example.com',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_ANON_KEY: 'anon-test',
    SUPABASE_SERVICE_ROLE_KEY: 'service-test',
    RATE_LIMIT_SALT: 'test-salt',
  };
  const originalEnv = new Map(Object.keys(values).map((key) => [key, Deno.env.get(key)]));
  for (const [key, value] of Object.entries(values)) Deno.env.set(key, value);
  let mode = 'invalid',
    calls = 0,
    mutations = 0;
  globalThis.fetch = (input, init) => {
    calls++;
    const url = String(input);
    if (url.endsWith('/auth/v1/user'))
      return Promise.resolve(
        mode === 'invalid'
          ? Response.json({ message: 'Invalid JWT' }, { status: 401 })
          : Response.json({ id: '11111111-1111-4111-a111-111111111111' }),
      );
    if (url.endsWith('/rpc/consume_registration_limit'))
      return Promise.resolve(Response.json(true));
    assert.ok(url.endsWith('/rpc/check_in_attendance'));
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer operator-token');
    if (mode === 'denied')
      return Promise.resolve(
        Response.json({ code: '42501', message: 'Unauthorized' }, { status: 403 }),
      );
    mutations++;
    return Promise.resolve(
      Response.json({
        id: crypto.randomUUID(),
        displayName: 'Lina Omar',
        createdAt: new Date().toISOString(),
        alreadyAttended: false,
      }),
    );
  };
  const request = (token = 'operator-token') =>
    new Request('https://test/register', {
      method: 'POST',
      headers: {
        origin: values.ALLOWED_ORIGINS,
        'content-type': 'application/json',
        'x-forwarded-for': '127.0.0.1',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        eventId: 'a1c08e5d-0817-4684-a03e-1b37c24e1aa1',
        requestId: crypto.randomUUID(),
        participantId: '001',
      }),
    });
  try {
    assert.equal((await handleAttendance(request(''))).status, 401);
    assert.equal(calls, 0);
    assert.equal((await handleAttendance(request())).status, 401);
    mode = 'denied';
    assert.equal((await handleAttendance(request())).status, 403);
    assert.equal(mutations, 0);
    mode = 'allowed';
    const response = await handleAttendance(request());
    assert.equal(response.status, 200);
    assert.equal((await response.json()).displayName, 'Lina Omar');
    assert.equal(mutations, 1);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of originalEnv) {
      if (value === undefined) Deno.env.delete(key);
      else Deno.env.set(key, value);
    }
  }
});

Deno.test(
  'CORS preflight accepts configured site URLs, blocks other origins, and needs no JWT',
  async () => {
    const before = Deno.env.get('ALLOWED_ORIGINS');
    Deno.env.set(
      'ALLOWED_ORIGINS',
      ' https://aiexpo.s3dyeh.com/ , http://127.0.0.1:4387/ , http://localhost:4387 ',
    );
    try {
      for (const origin of [
        'https://aiexpo.s3dyeh.com',
        'http://127.0.0.1:4387',
        'http://localhost:4387',
      ]) {
        const response = await handleAttendance(
          new Request('https://test/function', {
            method: 'OPTIONS',
            headers: {
              origin,
              'access-control-request-method': 'POST',
              'access-control-request-headers':
                'authorization, apikey, content-type, x-client-info, x-retry-count',
            },
          }),
        );
        assert.equal(response.status, 204);
        assert.equal(response.headers.get('access-control-allow-origin'), origin);
        assert.match(
          response.headers.get('access-control-allow-headers')!,
          /x-retry-count/,
        );
      }
      for (const origin of ['', 'null', 'https://aiexpo.s3dyeh.com.evil.test']) {
        const response = await handleAttendance(
          new Request('https://test/function', { method: 'OPTIONS', headers: { origin } }),
        );
        assert.equal(response.status, 403);
        assert.equal(response.headers.get('access-control-allow-origin'), null);
      }
    } finally {
      if (before === undefined) Deno.env.delete('ALLOWED_ORIGINS');
      else Deno.env.set('ALLOWED_ORIGINS', before);
    }
  },
);
