import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const container = `funtime-db-test-${randomUUID().slice(0, 8)}`;
const docker = (...args) =>
  execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
let created = false;
try {
  docker(
    'run',
    '--detach',
    '--rm',
    '--name',
    container,
    '--network',
    'none',
    '-e',
    'POSTGRES_PASSWORD=disposable-test-only',
    'postgres:17-alpine',
  );
  created = true;
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      docker('exec', container, 'pg_isready', '-U', 'postgres');
      ready = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  if (!ready) throw new Error('PostgreSQL did not become ready.');
  for (const [index, file] of [
    'supabase/tests/bootstrap.sql',
    'supabase/migrations/202609210001_event_registration.sql',
    'supabase/migrations/202609210002_event_identity.sql',
    'supabase/migrations/202609210003_operator_desk_and_capacity.sql',
    // Verify the unapplied dashboard migration is safe to re-run.
    'supabase/migrations/202609210003_operator_desk_and_capacity.sql',
    'supabase/migrations/202609210004_full_name_greetings.sql',
    'supabase/migrations/202609210004_full_name_greetings.sql',
    'supabase/tests/registration.sql',
  ].entries()) {
    const target = `/tmp/check-${index}.sql`;
    docker('cp', resolve(root, file), `${container}:${target}`);
    console.log(
      docker('exec', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-f', target),
    );
  }
} catch (error) {
  console.error(error.stderr?.toString() ?? error.message);
  process.exitCode = 1;
} finally {
  if (created) docker('stop', container);
}
