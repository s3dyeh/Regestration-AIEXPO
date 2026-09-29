import { audienceStatistics } from './audience-statistics';
import type { Attendee } from './attendees';

describe('Cohort statistics', () => {
  const person: Attendee = {
    id: '1',
    participantId: '001',
    fullName: 'Example Person',
    email: 'example@example.com',
    createdAt: '2026-09-29T00:00:00Z',
    attendedAt: null,
    isIeeeMember: true,
    major: 'Computer Science',
    gender: 'Not Provided',
    role: 'Graduate',
    universityName: 'UJ',
    majorCategory: 'Computing',
    referralSource: 'Friends',
  };
  it('separates registration from attendance and preserves every dimension denominator', () => {
    const result = audienceStatistics([
      person,
      {
        ...person,
        id: '2',
        participantId: '002',
        attendedAt: '2026-09-29T10:00:00Z',
        isIeeeMember: false,
        universityName: '',
        dataQualityNotes: 'Verify source',
      },
    ]);
    expect(result.total).toBe(1);
    expect(result.ieeeMembers).toBe(0);
    expect(result.audience.registeredTotal).toBe(2);
    expect(result.audience.registeredMembers).toBe(1);
    expect(result.audience.flaggedRecords).toBe(1);
    for (const rows of Object.values(result.audience.dimensions)) {
      expect(rows.reduce((sum, row) => sum + row.registered, 0)).toBe(2);
      expect(rows.reduce((sum, row) => sum + row.attended, 0)).toBe(1);
    }
    expect(
      result.audience.dimensions.universities.find((row) => row.name === 'Not Provided')?.attended,
    ).toBe(1);
    expect('genders' in result.audience.dimensions).toBeFalse();
  });
  it('classifies a known major even when its stored category is Not Provided', () => {
    const result = audienceStatistics([
      { ...person, majorCategory: 'Not Provided', attendedAt: '2026-09-29T10:00:00Z' },
    ]);
    expect(result.audience.dimensions.majorCategories).toEqual([
      {
        name: 'Computer Science and Information Technology',
        registered: 1,
        attended: 1,
        registeredMembers: 1,
        members: 1,
      },
    ]);
  });
  it('handles an empty event without inventing demographic data', () => {
    expect(audienceStatistics([]).audience.registeredTotal).toBe(0);
    expect('genders' in audienceStatistics([])).toBeFalse();
  });
});
