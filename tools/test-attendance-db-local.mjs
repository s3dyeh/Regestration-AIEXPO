// Optional fallback: PGLITE_MODULE points to an installed @electric-sql/pglite entry.
import { readFile, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
if (!process.env.PGLITE_MODULE)
  throw new Error('Set PGLITE_MODULE to the installed @electric-sql/pglite dist/index.js path.');
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db = new PGlite();
try {
  await db.exec(await readFile('supabase/tests/bootstrap.sql', 'utf8'));
  for (const file of (await readdir('supabase/migrations')).sort()) {
    if (file === '202609280001_attendance.sql') {
      await db.exec(`insert into public.event_registrations(event_id,request_id,"FNAME","LNAME",email,phone,major,gender,show_name)
        values ('a1c08e5d-0817-4684-a03e-1b37c24e1aa1',gen_random_uuid(),'Lina','Noor Omar','legacy@example.com','+962790000000','Engineering','Female',true)`);
    }
    await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'));
    if (file === '202609280001_attendance.sql') {
      await db.exec(`do $$ begin
        assert (select full_name from public.event_registrations where email = 'legacy@example.com') = 'Lina Noor Omar';
        assert (select participant_id = id::text and attended_at is null from public.event_registrations where email = 'legacy@example.com');
      end; $$; delete from public.event_registrations; delete from realtime.messages;`);
    }
    console.log(`Applied ${file}`);
  }
  await db.exec(await readFile('supabase/tests/attendance.sql', 'utf8'));
  await db.exec(await readFile('supabase/tests/audience-analytics.sql', 'utf8'));
  await db.exec(await readFile('supabase/tests/reset-attendance.sql', 'utf8'));
  console.log('Attendance SQL assertions passed.');
} catch (error) {
  console.error(error.message, error.where);
  process.exitCode = 1;
} finally {
  await db.close();
}
