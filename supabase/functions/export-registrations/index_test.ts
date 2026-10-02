import assert from 'node:assert/strict';
import { handleExport } from './index.ts';

Deno.test(
  'export rejects missing JWTs, invalid JWTs, non-operators and wrong origins; operator receives XLSX',
  async () => {
    const originalFetch = globalThis.fetch;
    const originalEnv = new Map(
      ['ALLOWED_ORIGINS', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'].map((key) => [
        key,
        Deno.env.get(key),
      ]),
    );
    Deno.env.set('ALLOWED_ORIGINS', 'https://expo.example.com');
    Deno.env.set('SUPABASE_URL', 'https://test.supabase.co');
    Deno.env.set('SUPABASE_ANON_KEY', 'test-key');
    let calls = 0;
    let mode = 'invalid';
    globalThis.fetch = (input, init) => {
      calls++;
      const url = String(input);
      if (url.endsWith('/auth/v1/user'))
        return Promise.resolve(
          mode === 'invalid'
            ? Response.json({ message: 'Invalid JWT' }, { status: 401 })
            : Response.json({ id: '11111111-1111-4111-a111-111111111111' }),
        );
      assert.ok(url.includes('admin_registration_export_page'));
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer test-token');
      return Promise.resolve(
        mode === 'denied'
          ? Response.json({ code: '42501', message: 'Unauthorized' }, { status: 403 })
          : Response.json({ cutoff: '2026-09-27T10:00:00Z', rows: [] }),
      );
    };
    const request = (token = 'test-token', origin = 'https://expo.example.com') =>
      new Request('https://test/export', {
        method: 'POST',
        headers: { origin, ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ eventId: 'a1c08e5d-0817-4684-a03e-1b37c24e1aa1' }),
      });
    try {
      assert.equal((await handleExport(request(''))).status, 401);
      assert.equal(
        (await handleExport(request('test-token', 'https://wrong.example.com'))).status,
        403,
      );
      assert.equal(calls, 0);
      assert.equal((await handleExport(request())).status, 401);
      mode = 'denied';
      assert.equal((await handleExport(request())).status, 403);
      mode = 'allowed';
      const response = await handleExport(request());
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.match(response.headers.get('content-type')!, /spreadsheetml/);
      assert.match(response.headers.get('content-disposition')!, /attachment;.*\.xlsx/);
      const bytes = new Uint8Array(await response.arrayBuffer());
      assert.equal(bytes[0], 80);
      assert.equal(bytes[1], 75);
    } finally {
      globalThis.fetch = originalFetch;
      for (const [key, value] of originalEnv) {
        if (value === undefined) Deno.env.delete(key);
        else Deno.env.set(key, value);
      }
    }
  },
);

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
        const response = await handleExport(
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
        const response = await handleExport(
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
