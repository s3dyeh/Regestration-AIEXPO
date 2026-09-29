import { registrationSchema } from '../domain';
import type { Registration } from '../domain';
import { majorCategory } from './major-category';
export const CSV_HEADERS = [
  'ID',
  'FullName',
  'EmailAddress',
  'isIeeeMember',
  'Role',
  'UniversityName',
  'Major',
];

/** Excel CSVs may use Windows-1252; strict UTF-8 avoids silent replacement characters. */
export function decodeParticipantCsv(bytes: ArrayBuffer): string {
  const prefix = new Uint8Array(bytes, 0, Math.min(2, bytes.byteLength));
  if (prefix[0] === 0xff && prefix[1] === 0xfe)
    return new TextDecoder('utf-16le', { fatal: true }).decode(bytes);
  if (prefix[0] === 0xfe && prefix[1] === 0xff)
    return new TextDecoder('utf-16be', { fatal: true }).decode(bytes);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252', { fatal: true }).decode(bytes);
  }
}

/** RFC-style quoted fields, escaped quotes, BOM, CRLF and embedded newlines. */
export function parseParticipantCsv(source: string): Registration[] {
  if (source.length > 5_000_000) throw new Error('CSV must be smaller than 5 MB.');
  const records: string[][] = [];
  let row: string[] = [],
    field = '',
    quoted = false,
    closed = false;
  const text = source.replace(/^\uFEFF/, '');
  for (let i = 0; i <= text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === undefined) throw new Error('CSV contains an unclosed quoted field.');
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += c;
    } else if (c === ',' || c === '\n' || c === '\r' || c === undefined) {
      row.push(field.trim());
      field = '';
      closed = false;
      if (c !== ',') {
        if (row.some((value) => value !== '')) records.push(row);
        row = [];
        if (c === '\r' && text[i + 1] === '\n') i++;
      }
    } else if (c === '"' && !field && !closed) quoted = true;
    else if (closed || c === '"') throw new Error('Invalid quoting in CSV.');
    else field += c;
  }
  const aliases: Record<string, string> = {
    'Full Name In English': 'FullName',
    'Email Address': 'EmailAddress',
    'Are you an IEEE member?': 'isIeeeMember',
    'What best describes you?': 'Role',
    'University Name': 'UniversityName',
  };
  const headers = records.shift()?.map((header) => aliases[header] ?? header);
  const metadata = [
    'Phone Number', // Accepted but ignored.
    'Gender', // Accepted but ignored for older CSVs.
    'IEEE Membership ID',
    'Major Category',
    'Company / Organization Name',
    'Position',
    'How did you hear about AI Expo Jordan 2026?',
    'Data Quality Notes',
  ];
  if (
    !headers ||
    new Set(headers).size !== headers.length ||
    CSV_HEADERS.some((h) => !headers.includes(h)) ||
    headers.some((h) => !CSV_HEADERS.includes(h) && !metadata.includes(h))
  )
    throw new Error('CSV headers must be: ' + CSV_HEADERS.join(', '));
  if (!records.length || records.length > 10000)
    throw new Error('Import between 1 and 10,000 participants.');
  const ids = new Set<string>();
  return records.map((values, index) => {
    if (values.length !== headers.length)
      throw new Error(`Row ${index + 2}: expected ${headers.length} columns.`);
    const get = (key: string) =>
      (values[headers.indexOf(key)] ?? '')
        .normalize('NFKC')
        .replace(/[\u200b-\u200f\u202a-\u202e\ufeff]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const member = get('isIeeeMember').toLowerCase();
    if (!['true', 'false', 'yes', 'no', '1', '0'].includes(member))
      throw new Error(`Row ${index + 2}: isIeeeMember must be true/false, yes/no or 1/0.`);
    const result = registrationSchema.safeParse({
      participantId: get('ID'),
      fullName: get('FullName'),
      email: get('EmailAddress'),
      isIeeeMember: ['true', 'yes', '1'].includes(member),
      role: get('Role'),
      universityName: get('UniversityName') || 'Not Provided',
      major: get('Major') || 'Not Provided',
      gender: 'Not Provided', // Compatibility with the existing database import contract.
      majorCategory: majorCategory(get('Major')),
      ieeeMembershipId: get('IEEE Membership ID'),
      organizationName: get('Company / Organization Name') || 'Not Provided',
      position: get('Position'),
      referralSource: get('How did you hear about AI Expo Jordan 2026?') || 'Not Provided',
      dataQualityNotes: get('Data Quality Notes'),
    });
    if (!result.success)
      throw new Error(
        `Row ${index + 2}: ${result.error.issues[0].path.join('.')} - ${result.error.issues[0].message}`,
      );
    if (ids.has(result.data.participantId))
      throw new Error(`Row ${index + 2}: duplicate ID ${result.data.participantId}.`);
    ids.add(result.data.participantId);
    return result.data;
  });
}
