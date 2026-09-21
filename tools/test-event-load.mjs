import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';

// Disposable integration test: real Edge Function + PostgreSQL. The small RPC
// bridge replaces hosted PostgREST; auth/realtime stubs do not test cloud delivery.
const container = `expo-load-${randomUUID().slice(0, 8)}`;
const password = randomUUID();
const docker = (...args) =>
  execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const eventId = 'a1c08e5d-0817-4684-a03e-1b37c24e1aa1';
const origin = 'http://localhost:4291';
let created = false,
  pool,
  bridge,
  edge;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
try {
  docker(
    'run',
    '-d',
    '--rm',
    '--name',
    container,
    '-p',
    '127.0.0.1::5432',
    '-e',
    `POSTGRES_PASSWORD=${password}`,
    'postgres:17-alpine',
    '-c',
    'max_connections=150',
  );
  created = true;
  const port = Number(docker('port', container, '5432/tcp').trim().split(':').pop());
  pool = new pg.Pool({ host: '127.0.0.1', port, user: 'postgres', password, max: 100 });
  for (let i = 0; ; i++) {
    try {
      await pool.query('select 1');
      break;
    } catch (error) {
      if (i === 30) throw error;
      await pause(500);
    }
  }
  await pool.query(await readFile('supabase/tests/bootstrap.sql', 'utf8'));
  for (const file of (await readdir('supabase/migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    await pool.query(await readFile(`supabase/migrations/${file}`, 'utf8'));
  }
  bridge = createServer(async (req, res) => {
    res.setHeader('content-type', 'application/json');
    try {
      let body = '';
      for await (const chunk of req) body += chunk;
      const p = JSON.parse(body);
      let result;
      if (req.url === '/rest/v1/rpc/consume_registration_limit') {
        result = await pool.query('select public.consume_registration_limit($1) as value', [
          p.client_hash,
        ]);
      } else if (req.url === '/rest/v1/rpc/submit_registration') {
        result = await pool.query('select public.submit_registration($1,$2,$3) as value', [
          p.target_event,
          p.request_id,
          p.details,
        ]);
      } else {
        res.writeHead(404).end();
        return;
      }
      res.end(JSON.stringify(result.rows[0].value));
    } catch (error) {
      res.writeHead(400).end(JSON.stringify({ code: error.code, message: error.message }));
    }
  });
  await new Promise((resolve) => bridge.listen(0, '127.0.0.1', resolve));
  const reservation = createServer();
  await new Promise((resolve) => reservation.listen(0, '127.0.0.1', resolve));
  const edgePort = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  let edgeOutput = '';
  edge = spawn(
    process.platform === 'win32' ? 'node_modules/deno/deno.exe' : 'node_modules/deno/deno',
    [
      'run',
      '--allow-net',
      '--allow-env',
      '--config',
      'supabase/functions/register/deno.json',
      'supabase/functions/register/index.ts',
    ],
    {
      windowsHide: true,
      env: {
        ...process.env,
        PORT: String(edgePort),
        SUPABASE_URL: `http://127.0.0.1:${bridge.address().port}`,
        SUPABASE_SERVICE_ROLE_KEY: 'disposable-test-key',
        ALLOWED_ORIGINS: origin,
        RATE_LIMIT_SALT: randomUUID(),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  edge.stdout.on('data', (data) => {
    edgeOutput += data;
  });
  edge.stderr.on('data', (data) => {
    edgeOutput += data;
  });
  const url = `http://127.0.0.1:${edgePort}`;
  for (let i = 0; ; i++) {
    try {
      await fetch(url);
      break;
    } catch {
      if (i === 90 || edge.exitCode !== null) throw new Error(`Edge startup failed: ${edgeOutput}`);
      await pause(500);
    }
  }
  const payload = (index) => ({
    eventId,
    requestId: randomUUID(),
    registration: {
      name: 'Load Participant',
      email: `load-${index}@example.com`,
      phone: '+962791234567',
      major: 'Computer Science',
      gender: 'Female',
      showName: index % 2 === 0,
    },
  });
  const submit = async (body, ip, requestOrigin = origin) => {
    const start = performance.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: { origin: requestOrigin, 'content-type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify(body),
    });
    return {
      status: response.status,
      body: await response.json(),
      ms: performance.now() - start,
      retry: response.headers.get('retry-after'),
    };
  };
  const durations = [],
    ids = new Set();
  const started = performance.now();
  for (let batch = 0; batch < 10; batch++) {
    const results = await Promise.all(
      Array.from({ length: 100 }, (_, i) => {
        const index = batch * 100 + i;
        return submit(payload(index), `198.18.${batch}.${Math.floor(i / 2) + 1}`);
      }),
    );
    for (const result of results) {
      assert.equal(result.status, 200, JSON.stringify(result.body));
      assert.equal(Object.hasOwn(result.body, 'email'), false);
      ids.add(result.body.id);
      durations.push(result.ms);
    }
    console.log(`Batch ${batch + 1}: 100/100 accepted, 50 IPs, two simultaneous requests per IP.`);
  }
  assert.equal(ids.size, 1000);
  assert.equal(
    Number((await pool.query('select count(*) from public.event_registrations')).rows[0].count),
    1000,
  );
  const duplicate = await Promise.all(
    Array.from({ length: 2 }, () => submit(payload('duplicate'), '198.19.0.1')),
  );
  assert.deepEqual(duplicate.map((r) => r.status).sort(), [200, 409]);
  const retryBody = payload('retry');
  const retries = await Promise.all(
    Array.from({ length: 2 }, () => submit(retryBody, '198.19.0.2')),
  );
  assert(retries.every((r) => r.status === 200));
  assert.equal(retries[0].body.id, retries[1].body.id);
  assert.equal(
    (
      await submit(
        { ...payload('bad'), registration: { ...payload('bad').registration, name: '--' } },
        '198.19.0.3',
      )
    ).status,
    400,
  );
  assert.equal(
    (await submit(payload('cors'), '198.19.0.4', 'https://not-allowed.example')).status,
    403,
  );
  const rateBody = payload('rate');
  for (let i = 0; i < 20; i++) assert.equal((await submit(rateBody, '198.19.0.5')).status, 200);
  const limited = await submit(rateBody, '198.19.0.5');
  assert.equal(limited.status, 429);
  assert.equal(limited.retry, '60');
  durations.sort((a, b) => a - b);
  const report = {
    scope:
      'Local Deno HTTP endpoint + PostgreSQL; PostgREST bridge and Supabase auth/realtime test doubles. Not a hosted capacity guarantee.',
    attendees: 1000,
    concurrentRequests: 100,
    concurrentPerIp: 2,
    accepted: ids.size,
    p95Ms: Math.round(durations[Math.ceil(durations.length * 0.95) - 1]),
    maxMs: Math.round(durations.at(-1)),
    elapsedMs: Math.round(performance.now() - started),
    duplicateRace: 'passed',
    idempotentRace: 'passed',
    validation: 'passed',
    cors: 'passed',
    rateLimit: 'passed',
  };
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/event-load.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error.stderr?.toString() ?? error);
  process.exitCode = 1;
} finally {
  if (edge && edge.exitCode === null) {
    edge.kill();
    await new Promise((resolve) => edge.once('exit', resolve));
  }
  if (bridge) await new Promise((resolve) => bridge.close(resolve));
  if (pool) await pool.end();
  if (created) docker('stop', container);
}
