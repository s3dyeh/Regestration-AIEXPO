import { displayName, welcomeSchema } from './domain';
import { decodeParticipantCsv, parseParticipantCsv, CSV_HEADERS } from './data/participant-csv';
describe('Participant import contract', () => {
  const csv =
    CSV_HEADERS.join(',') +
    ',Gender' +
    '\r\n001,"أحمد سعدية",AHMAD@example.com,yes,Student,University of Jordan,Engineering,Male';
  it('preserves ID zeros and full names without phone', () => {
    const row = parseParticipantCsv('\uFEFF' + csv)[0];
    expect(row.participantId).toBe('001');
    expect('phone' in row).toBeFalse();
    expect(row.email).toBe('ahmad@example.com');
    expect(row.isIeeeMember).toBeTrue();
    expect(row.gender).toBe('Not Provided');
    expect(displayName(row)).toBe('أحمد سعدية');
  });
  it('publishes a template without gender', () => {
    expect(CSV_HEADERS).not.toContain('Gender');
    const source =
      CSV_HEADERS.join(',') +
      '\n001,Lina Omar,lina@example.com,true,Student,UJ,Engineering';
    expect(parseParticipantCsv(source)[0].participantId).toBe('001');
    expect(
      parseParticipantCsv(source.replace('Engineering', 'Computer Science'))[0].majorCategory,
    ).toBe('Computer Science and Information Technology');
    expect(
      parseParticipantCsv(source.replace('Engineering', 'Ambiguous field'))[0].majorCategory,
    ).toBe('Unclassified');
  });
  it('decodes Excel punctuation without corrupting UTF-8 Arabic', () => {
    expect(decodeParticipantCsv(new Uint8Array([73, 0x92, 109]).buffer)).toBe('I’m');
    expect(decodeParticipantCsv(new TextEncoder().encode('أحمد').buffer)).toBe('أحمد');
  });
  it('accepts escaped quotes, commas and embedded newlines', () => {
    const row = parseParticipantCsv(csv.replace('"أحمد سعدية"', '"Lina, ""Noor""\nOmar"'))[0];
    expect(row.fullName).toBe('Lina, "Noor" Omar');
  });
  it('rejects missing headers, malformed quotes, duplicate IDs and invalid booleans', () => {
    expect(() => parseParticipantCsv(csv.replace('FullName', 'Name'))).toThrow();
    expect(() => parseParticipantCsv(csv + '\n' + csv.split('\r\n')[1])).toThrowError(
      /duplicate ID/,
    );
    expect(() => parseParticipantCsv(csv.replace(',yes,', ',maybe,'))).toThrowError(/isIeeeMember/);
    expect(() => parseParticipantCsv(csv + '\n"broken')).toThrowError(/unclosed/);
    expect(() => parseParticipantCsv(CSV_HEADERS.join(','))).toThrowError(/between 1/);
  });
  it('does not expose contact fields in welcomes', () => {
    const event = welcomeSchema.parse({
      id: crypto.randomUUID(),
      displayName: 'Lina Omar',
      createdAt: new Date().toISOString(),
      alreadyAttended: true,
      email: 'private@example.com',
    });
    expect('email' in event).toBeFalse();
    expect(event.alreadyAttended).toBeTrue();
  });
  it('imports cleaned English headers and keeps absent demographics explicit', () => {
    const source =
      'ID,Full Name In English,Email Address,Phone Number,Are you an IEEE member?,What best describes you?,University Name,Major,Major Category,Data Quality Notes\n001,Lina Omar,lina@example.com,+962790000000,Yes,Graduate,,,Not Provided,Review';
    const row = parseParticipantCsv(source)[0];
    expect(row.fullName).toBe('Lina Omar');
    expect(row.isIeeeMember).toBeTrue();
    expect(row.role).toBe('Graduate');
    expect(row.universityName).toBe('Not Provided');
    expect(row.major).toBe('Not Provided');
    expect(row.gender).toBe('Not Provided');
  });
});
