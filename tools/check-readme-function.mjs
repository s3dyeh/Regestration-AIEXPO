import ts from 'typescript';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Exercise emitted JavaScript in plain Node, without tsx's extension resolution.
const root = process.cwd();
const out = resolve(root, '.vercel/function-smoke');
const config = ts.readConfigFile(join(root, 'tsconfig.json'), ts.sys.readFile);
if (config.error) throw new Error('Cannot read TypeScript configuration');
const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
for (const file of [
  'api/readme-ai.ts',
  'server/readme-ai.ts',
  'server/gemini.ts',
  'server/readme-generate.ts',
  'src/app/features/readme/readme-generation-contract.ts',
  'src/app/features/readme/profile-badges.ts',
  'src/app/features/readme/readme-ai-contract.ts',
]) {
  const source = await readFile(join(root, file), 'utf8');
  const target = join(out, file.replace(/\.ts$/, '.js'));
  await mkdir(dirname(target), { recursive: true });
  await writeFile(
    target,
    ts.transpileModule(source, { compilerOptions: options, fileName: file }).outputText,
  );
}
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
await writeFile(join(out, 'package.json'), JSON.stringify({ type: packageJson.type }));
const probe = `
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import handler from './api/readme-ai.js';
delete process.env.GEMINI_API_KEY;
const server = createServer((req, res) => { Promise.resolve(handler(req, res)).catch(() => { res.writeHead(500); res.end('Uncaught handler error'); }); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  const host = '127.0.0.1:' + server.address().port;
  const headers = { origin: 'https://' + host, 'content-type': 'application/json' };
  const methodResponse = await fetch('http://' + host, { headers });
  assert.equal(methodResponse.status, 405);
  assert.equal((await methodResponse.json()).message, 'Use POST.');
  const post = await fetch('http://' + host, { method: 'POST', headers, body: '{}' });
  assert.equal(post.status, 503);
  assert.match((await post.json()).message, /GEMINI_API_KEY/);
  console.log('Compiled function starts in Node and returns JSON for GET and POST.');
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
`;
await writeFile(join(out, 'probe.mjs'), probe);
// Vercel's loader does not rely on Node's automatic ESM syntax detection.
const result = spawnSync(
  process.execPath,
  ['--no-experimental-detect-module', '--no-experimental-require-module', join(out, 'probe.mjs')],
  { encoding: 'utf8' },
);
process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');
process.exitCode = result.status ?? 1;
