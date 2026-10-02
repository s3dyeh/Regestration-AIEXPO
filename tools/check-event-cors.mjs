import assert from 'node:assert/strict';
const base =
  process.env.EVENT_FUNCTIONS_URL ?? 'https://eibwjkrickjbktaqsaus.supabase.co/functions/v1';
const origins = process.argv.slice(2);
if (!origins.length)
  origins.push('https://aiexpo.s3dyeh.com', 'http://127.0.0.1:4387', 'http://localhost:4387');
for (const name of ['register', 'export-registrations']) {
  for (const origin of origins) {
    const response = await fetch(`${base}/${name}`, {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers':
          'authorization,apikey,content-type,x-client-info,x-retry-count',
      },
    });
    console.log(`${name}: ${origin} -> OPTIONS ${response.status}`);
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
    assert.match(response.headers.get('access-control-allow-headers'), /x-retry-count/);
    // No user token or participant data: this must stop before any database mutation.
    const post = await fetch(`${base}/${name}`, {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(post.status, 401);
    assert.equal(post.headers.get('access-control-allow-origin'), origin);
  }
  const denied = await fetch(`${base}/${name}`, {
    method: 'OPTIONS',
    headers: { Origin: 'https://untrusted.example' },
  });
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
}
console.log('CORS passes; unauthenticated POSTs and untrusted origins remain blocked.');
