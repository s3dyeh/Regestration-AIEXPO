import { majorCategory } from './major-category';
import { emptyStats } from '../domain';
import type { CohortRow, Dimension, EventStats } from '../domain';
import type { Attendee } from './attendees';

export function audienceStatistics(all: Attendee[]): EventStats {
  const stats = emptyStats();
  const rows = all.filter((row) => row.attendedAt !== null);
  const keys: Record<Dimension, keyof Attendee> = {
    universities: 'universityName',
    roles: 'role',
    majors: 'major',
    majorCategories: 'majorCategory',
    referrals: 'referralSource',
    organizations: 'organizationName',
  };
  stats.total = rows.length;
  stats.ieeeMembers = rows.filter((row) => row.isIeeeMember).length;
  stats.audience.registeredTotal = all.length;
  stats.audience.registeredMembers = all.filter((row) => row.isIeeeMember).length;
  stats.audience.flaggedRecords = all.filter((row) => row.dataQualityNotes?.trim()).length;
  for (const dimension of Object.keys(keys) as Dimension[]) {
    const groups = new Map<string, CohortRow>();
    for (const row of all) {
      const name =
        dimension === 'majorCategories'
          ? majorCategory(row.major)
          : String(row[keys[dimension]] ?? '').trim() || 'Not Provided';
      const group = groups.get(name) ?? {
        name,
        registered: 0,
        attended: 0,
        registeredMembers: 0,
        members: 0,
      };
      group.registered++;
      if (row.isIeeeMember) group.registeredMembers++;
      if (row.attendedAt !== null) {
        group.attended++;
        if (row.isIeeeMember) group.members++;
      }
      groups.set(name, group);
    }
    stats.audience.dimensions[dimension] = [...groups.values()].sort(
      (a, b) => b.registered - a.registered || a.name.localeCompare(b.name),
    );
  }
  for (const dimension of ['universities', 'roles', 'majors'] as const) {
    stats[dimension] = stats.audience.dimensions[dimension]
      .filter((row) => row.attended)
      .map((row) => ({ name: row.name, count: row.attended }));
  }
  stats.recent = [...rows]
    .sort((a, b) => b.attendedAt!.localeCompare(a.attendedAt!))
    .slice(0, 6)
    .map((row) => ({ id: row.id, displayName: row.fullName, createdAt: row.attendedAt! }));
  return stats;
}
