import { readFile, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
if (!process.env.PGLITE_MODULE) throw new Error('Set PGLITE_MODULE to the local PGlite module.');
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db = new PGlite();
try {
  await db.exec(await readFile('supabase/tests/bootstrap.sql', 'utf8'));
  for (const migration of (await readdir('supabase/migrations')).sort()) {
    await db.exec(await readFile(`supabase/migrations/${migration}`, 'utf8'));
  }
  const sql = await readFile(process.argv[2] || 'AI_EXPO_Jordan_2026_Seed.sql', 'utf8');
  await db.exec(sql);
  assert.equal(
    (
      await db.query(
        "select count(*)::int as count from information_schema.columns where table_schema = 'public' and table_name = 'event_registrations' and column_name = 'phone'",
      )
    ).rows[0].count,
    0,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int as count from public.event_registrations where major <> 'Not Provided' and major_category = 'Not Provided'",
      )
    ).rows[0].count,
    0,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int as count from public.event_registrations where participant_id !~ '^[0-9]{3}$'",
      )
    ).rows[0].count,
    0,
  );
  let result = await db.query(
    'select count(*)::int as total, count(attended_at)::int as attended from public.event_registrations',
  );
  assert.deepEqual(result.rows[0], { total: 228, attended: 0 });
  await db.exec(`insert into auth.users values ('11111111-1111-4111-a111-111111111111');
    insert into public.event_operators values ('a1c08e5d-0817-4684-a03e-1b37c24e1aa1','11111111-1111-4111-a111-111111111111');
    select set_config('request.jwt.claim.sub','11111111-1111-4111-a111-111111111111',false);
    select public.check_in_attendance('a1c08e5d-0817-4684-a03e-1b37c24e1aa1',gen_random_uuid(),'001');`);
  const snapshot = async () =>
    JSON.stringify(
      (await db.query('select * from public.event_registrations order by participant_id')).rows,
    );
  const before = await snapshot();
  await db.exec(
    "update public.event_registrations set participant_id = '1' where participant_id = '001'; update public.attendance_scans set participant_id = '1' where participant_id = '001';",
  );
  await db.exec(sql);
  assert.equal(
    await snapshot(),
    before,
    'Re-running must preserve all existing profiles and attendance',
  );
  result = await db.query(
    'select count(*)::int as total, count(attended_at)::int as attended from public.event_registrations',
  );
  assert.deepEqual(result.rows[0], { total: 228, attended: 1 });
  console.log(
    'Seed verified: 228 participants, no automatic attendance, repeat execution preserves all records.',
  );
} finally {
  await db.close();
}
