import csv
import json
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

import openpyxl

SOURCE = Path(r'C:\Users\Ahmad.Sadieh\Downloads\AI_EXPO_Jordan_2026_Accepted.xlsx')
OUT = Path(__file__).parent

def clean(value):
    if value is None:
        return ''
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    value = unicodedata.normalize('NFKC', str(value))
    value = re.sub(r'[\u200b-\u200f\u202a-\u202e\ufeff]', '', value)
    value = re.sub(r'\s+', ' ', value).strip()
    if value.lower() in {'.', '..', '-', 'n/a', 'none', 'null', 'there is no account yet'}:
        return ''
    return value

TRANSLATIONS = {
    'فرح محمد خلف بني صخر': 'Farah Mohammad Khalaf Bani Sakhr',
    'هندسة أمن الشبكات والمعلومات': 'Network and Information Security Engineering',
    'زيد السرور': 'Zaid Al-Surour',
    'آمال محمد هلال العطين': 'Amal Mohammad Hilal Al-Atin',
    'أثير للتمنية الشبابية': 'Atheer for Youth Development',
    'الزرقاء': 'Zarqa',
    'سامي رائد شعبان الخليلي': 'Sami Raed Shaaban Al-Khalili',
    'محمد بلال قدورة': 'Mohammad Bilal Qaddoura',
}

def name_case(value):
    # Keep supplied spellings and intentional internal capitalization.
    return ' '.join('-'.join(p.capitalize() if p.isupper() or p.islower() else p for p in t.split('-')) for t in value.split())

def key(value):
    return re.sub(r'\s+', ' ', value.casefold()).strip().rstrip('.')

MAJORS = {}
def major_group(canonical, category, *variants):
    for value in (canonical, *variants):
        MAJORS[key(value)] = (canonical, category)

IT = 'Computer Science and Information Technology'
AI = 'Artificial Intelligence, Data Science and Robotics'
SEC = 'Cybersecurity and Network Security'
ENG = 'Engineering'
BUS = 'Business and Management'
HEALTH = 'Health Sciences'
major_group('Computer Science', IT, 'CS', 'computer since')
major_group('Software Engineering', IT, 'Software engineer')
major_group('Computer Information Systems', IT, 'CIS')
major_group('Computer Science (Virtual and Augmented Reality)', IT, 'Virtual and augmented reality /computer science')
major_group('Computer Science (Data Science Track)', IT, 'Computer science - data science track')
major_group('Artificial Intelligence', AI, 'AI')
major_group('Data Science and Artificial Intelligence', AI, 'AI and DS', 'Ai & Data science', 'AI and data science', 'Data science and Ai', 'AI & Data Science', 'artificial intelligence and data science', 'DS&AI', 'Ai&ds')
major_group('Data Science', AI)
major_group('Robotics and Artificial Intelligence', AI, 'Robotic & AI', 'Robotics and AI', 'ROBOTICS & AI')
major_group('Artificial Intelligence and Robotics Engineering', AI, 'Ai and robotics engineer', 'Artificial Intelligence & Robotics Engineering.', 'Ai & Robotics Engineering')
major_group('Cybersecurity', SEC, 'Cyber Security', 'Cys')
major_group('Information Security', SEC)
major_group('Network and Information Security', SEC, 'Security and confidentiality of networks and information', 'Information and network security', 'Information and network security and confidentiality')
major_group('Network and Information Security Engineering', SEC)
major_group('Computer Networks and Cybersecurity', SEC, 'Computer network and cybersecurity')
major_group('Computer Engineering', ENG, 'CPE', 'Computers Engineering', 'Computer Engineers')
major_group('Computer Engineering (Internet of Things)', ENG, 'Computer Engineering/IoT')
major_group('Biomedical Engineering', ENG)
major_group('Medical Engineering', ENG, 'Medical eng')
major_group('Industrial Engineering', ENG, 'Infustrial engineering')
major_group('Electrical Engineering', ENG, 'Electrical Engineer')
major_group('Electrical Engineering (Network and Systems Security)', ENG, 'Electrical engineering/network and systems security')
major_group('Mechanical Engineering', ENG)
major_group('Biomedical Informatics Engineering', ENG)
major_group('Smart and Sustainable Cities Engineering', ENG)
major_group('Business Information Technology', BUS, 'BIT')
major_group('Management Information Systems', BUS, 'Management information system')
major_group('Business Intelligence and Data Analytics', BUS)
major_group('Marketing', BUS)
major_group('Pharmacy', HEALTH)
major_group('Dentistry', HEALTH)
major_group('Chemistry', 'Natural Sciences')
major_group('SLP', 'Unclassified')
major_group('Member', 'Unclassified')

book = openpyxl.load_workbook(SOURCE, data_only=True)
assert book.sheetnames == ['Accepted']
source_rows = list(book.active.values)
records = []
change_counts = Counter()
for source_row in source_rows[1:]:
    if not any(v is not None for v in source_row):
        continue
    row = [clean(v) for v in source_row]
    flags = []
    for j, value in enumerate(row):
        if value in TRANSLATIONS:
            row[j] = TRANSLATIONS[value]
            change_counts['Arabic cells translated or transliterated'] += 1
    for j in [1, 13]:
        row[j] = name_case(row[j])
    row[2] = row[2].lower()
    if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', row[2]):
        flags.append('Email format needs review')
    phone = re.sub(r'[\s()\-]', '', row[3])
    if phone.startswith('+9620'):
        phone = '+962' + phone[5:]
        change_counts['Redundant domestic phone prefixes removed'] += 1
    assert re.fullmatch(r'\+962\d{9}', phone), (row[0], phone)
    row[3] = phone
    if not phone.startswith(('+96277', '+96278', '+96279')):
        flags.append('Phone prefix differs from the other registrations; verify')
    linkedin = row[4]
    match = re.search(r'(?:https?://)?(?:www\.)?linkedin\.com/\S+', linkedin, re.I)
    if match:
        url = match.group(0)
        if not url.lower().startswith(('http://', 'https://')):
            url = 'https://' + url
        parts = urlsplit(url)
        query = [(k,v) for k,v in parse_qsl(parts.query) if not k.lower().startswith('utm_') and k.lower() not in {'trk', 'trackingid'}]
        row[4] = urlunsplit(('https', parts.netloc.lower(), parts.path.rstrip('/'), urlencode(query), ''))
        if not parts.path.startswith('/in/'):
            flags.append('LinkedIn link is not a public profile link')
        if match.start() > 0:
            flags.append('LinkedIn profile URL extracted from mixed name and URL entry')
    elif linkedin:
        flags.append('LinkedIn entry is text rather than a profile URL')
    if row[5] == 'Yes' and not row[6]:
        flags.append('IEEE member selected Yes but membership ID is missing')
    if row[6] and (not row[6].isdigit() or len(row[6]) < 8 or len(set(row[6])) == 1):
        flags.append('IEEE membership ID looks incomplete or like a placeholder; verify')
    row[7] = {'Academic/ Researcher': 'Academic / Researcher', 'Company/Startup Manager': 'Company / Startup Manager', 'Others': 'Other'}.get(row[7], row[7])
    if row[8] == 'Others':
        row[8] = 'Other'
        flags.append('University specified as Other without a name')
    if row[9]:
        assert key(row[9]) in MAJORS, ('unmapped major', row[9])
        row[9], category = MAJORS[key(row[9])]
    else:
        category = 'Not Provided'
    if row[9] == 'Member':
        flags.append('Major entry Member does not identify a field of study')
    if row[9] == 'SLP':
        flags.append('Major abbreviation SLP needs confirmation before expansion and categorization')
    if row[7] in {'Undergraduate', 'Graduate'} and not row[9]:
        flags.append('Major is missing')
    if row[11].lower() == 'coo':
        row[11] = 'COO'
    if row[0] == '226':
        flags.append('Position contains the city Zarqa rather than a job title')
        flags.append('Organization translation assumes the intended word is development despite a source typo')
    if row[11] and len(row[11]) == 1:
        flags.append('Position is a single letter; verify')
    row[12] = {'Family/ Friends': 'Family / Friends', 'Social Media (Linkedin/Instagram/etc)': 'Social Media (LinkedIn / Instagram / Other)', 'Others': 'Other'}.get(row[12], row[12])
    if row[12] == 'Ambassadors' and not row[13]:
        flags.append('Ambassador referral selected but ambassador name is missing')
    records.append({'values': row, 'category': category, 'flags': flags})

duplicate_groups = {}
for j, label in [(2, 'Email Address'), (3, 'Phone Number'), (6, 'IEEE Membership ID')]:
    groups = defaultdict(list)
    for record in records:
        value = record['values'][j]
        if value:
            groups[value.casefold()].append(record)
    duplicates = [rs for rs in groups.values() if len(rs) > 1]
    duplicate_groups[label] = [[r['values'][0] for r in rs] for rs in duplicates]
    for group in duplicates:
        for record in group:
            others = ', '.join(r['values'][0] for r in group if r is not record)
            record['flags'].append(f'{label} also used by registration ID {others}; retained for review')

headers = ['ID', 'Full Name In English', 'Email Address', 'Phone Number', 'LinkedIn Account', 'Are you an IEEE member?', 'IEEE Membership ID', 'What best describes you?', 'University Name', 'Major', 'Major Category', 'Company / Organization Name', 'Position', 'How did you hear about AI Expo Jordan 2026?', 'Which ambassador referred you?', 'Tags', 'Tickets', 'Data Quality Notes']
result = [r['values'][:10] + [r['category']] + r['values'][10:] + ['; '.join(r['flags'])] for r in records]
removed_columns = {'LinkedIn Account', 'Which ambassador referred you?', 'Tags', 'Tickets'}
keep = [i for i, header in enumerate(headers) if header not in removed_columns]
headers = [headers[i] for i in keep]
result = [[row[i] for i in keep] for row in result]
for row in result:
    row[-1] = '; '.join(note for note in row[-1].split('; ') if not note.startswith(('LinkedIn', 'Ambassador referral')))
assert len(result) == len(source_rows) - 1 == 228
assert len(set(r[0] for r in result)) == 228
assert all(len(r) == len(headers) for r in result)
assert not any(re.search(r'[\u0600-\u06ff]', v) for r in result for v in r)
assert [r[0] for r in result] == [str(r[0]) for r in source_rows[1:]]
output = OUT / 'AI_EXPO_Jordan_2026_Ready_For_Import.csv'
with output.open('w', encoding='utf-8-sig', newline='') as stream:
    writer = csv.writer(stream)
    writer.writerow(headers)
    writer.writerows(result)
with output.open(encoding='utf-8-sig', newline='') as stream:
    assert list(csv.reader(stream)) == [headers] + result
summary = {
    'registrations': len(result),
    'columns': len(headers),
    'distinct_source_majors_nonblank': len(set(clean(r[9]) for r in source_rows[1:] if clean(r[9]))),
    'distinct_standardized_majors_excluding_unclear': len(set(r['values'][9] for r in records if r['category'] not in {'Unclassified', 'Not Provided'})),
    'categories': dict(Counter(r['category'] for r in records)),
    'rows_with_review_notes': sum(bool(r[-1]) for r in result),
    'duplicate_groups': duplicate_groups,
    'changes': dict(change_counts),
    'output': str(output.resolve()),
}
(OUT / 'validation_summary.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
print(json.dumps(summary, indent=2))
