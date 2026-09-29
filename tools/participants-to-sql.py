"""Convert a private attendee CSV into an idempotent PostgreSQL seed; never execute it."""
import json
import argparse
import csv
import io
import re
import unicodedata
import uuid
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('source', type=Path)
parser.add_argument('output', type=Path)
parser.add_argument('--event', required=True, type=uuid.UUID)
args = parser.parse_args()
raw = args.source.read_bytes()
try:
    source = raw.decode('utf-8-sig')
    encoding = 'UTF-8'
except UnicodeDecodeError:
    source = raw.decode('cp1252')
    encoding = 'Windows-1252'

def clean(value):
    value = unicodedata.normalize('NFKC', value or '')
    if '\x00' in value or '\ufffd' in value:
        raise ValueError('Invalid text encoding or null byte')
    return re.sub(r'\s+', ' ', re.sub(r'[\u200b-\u200f\u202a-\u202e\ufeff]', '', value)).strip()

def literal(value):
    return "'" + value.replace("'", "''") + "'"

category_groups = json.loads((Path(__file__).resolve().parents[1] / 'src/app/features/event/data/major-categories.json').read_text())
def major_key(value):
    return re.sub(r'\s+', ' ', value.strip().lower()).removesuffix('.')
category_map = {major_key(major): category for category, majors in category_groups.items() for major in majors}
reader = csv.DictReader(io.StringIO(source))
rows = list(reader)
if not rows or len(rows) > 10000:
    raise ValueError('Expected 1 to 10000 participants')
ids = set()
values = []
for index, row in enumerate(rows, 2):
    if None in row or None in row.values():
        raise ValueError(f'CSV row {index}: mismatched columns')
    def field(*names, default=''):
        return next((clean(row[n]) for n in names if n in row), default)
    pid = field('ID')
    if re.fullmatch(r'[0-9]{1,2}', pid):
        pid = pid.zfill(3)
    name = field('Full Name In English', 'FullName')
    email = field('Email Address', 'EmailAddress').lower()
    member = field('Are you an IEEE member?', 'isIeeeMember').lower()
    role = field('What best describes you?', 'Role')
    university = field('University Name', 'UniversityName') or 'Not Provided'
    major = field('Major') or 'Not Provided'
    category = 'Not Provided' if major_key(major) == 'not provided' else category_map.get(major_key(major), 'Unclassified')
    for value, limit in [(pid,100),(name,100),(email,254),(role,100),(university,200),(major,200),(category,200)]:
        if not value or len(value) > limit:
            raise ValueError(f'CSV row {index}: missing or oversized field')
    if pid in ids or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
        raise ValueError(f'CSV row {index}: duplicate ID or invalid email')
    if member not in ('yes','no','true','false','1','0'):
        raise ValueError(f'CSV row {index}: invalid membership value')
    ids.add(pid)
    values.append('  (' + ', '.join([
        literal(str(args.event)) + '::uuid', 'gen_random_uuid()',
        literal(pid),literal(name),literal(email),
        'true' if member in ('yes','true','1') else 'false',
        literal(role),literal(university),literal(major),literal(category),
        "'Not Provided'",'true','null',
    ]) + ')')

sql = f'''-- Private participant seed: {len(rows)} records. Run in the Supabase SQL Editor as an administrator.
-- Requires migrations through 202609290005. Safe to re-run: existing event + ID records are skipped.
-- Numeric IDs use at least three digits. Existing short numeric IDs are renamed in place.
-- Registration does not mark attendance. Profile details and attendance are preserved.
begin;
set local standard_conforming_strings = on;
-- Prevent duplicate identities when this seed was previously run with IDs such as 1 or 22.
lock table public.event_registrations, public.attendance_scans in share row exclusive mode;
do $$
begin
  if exists (
    select 1 from public.event_registrations r
    join public.event_registrations existing
      on existing.event_id = r.event_id
     and existing.participant_id = lpad(r.participant_id, 3, '0')
    where r.event_id = '{args.event}'::uuid and r.participant_id ~ '^[0-9]{{1,2}}$'
  ) then
    raise exception 'Both short and padded participant IDs exist. Resolve the ID collision before running this seed.';
  end if;
end $$;
update public.event_registrations
set participant_id = lpad(participant_id, 3, '0')
where event_id = '{args.event}'::uuid and participant_id ~ '^[0-9]{{1,2}}$';
update public.attendance_scans
set participant_id = lpad(participant_id, 3, '0')
where event_id = '{args.event}'::uuid and participant_id ~ '^[0-9]{{1,2}}$';
with inserted as (
  insert into public.event_registrations
    (event_id, request_id, participant_id, full_name, email, is_ieee_member,
     role, university_name, major, major_category, gender, show_name, attended_at)
  values
''' + ',\n'.join(values) + '''
  on conflict (event_id, participant_id) do nothing
  returning participant_id
)
select count(*) as participants_inserted from inserted;
commit;
'''
args.output.write_text(sql, encoding='utf-8', newline='\n')
print(f'Created SQL for {len(rows)} unique IDs ({encoding}); no database changes made.')
