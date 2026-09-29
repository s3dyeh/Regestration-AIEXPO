export interface ExportRegistration {
  id: string;
  eventId: string;
  requestId: string;
  createdAt: string;
  fullName: string;
  participantId: string;
  isIeeeMember: boolean;
  role: string;
  universityName: string;
  attendedAt: string | null;
  email: string;
  major: string;
  gender: string;
  showName: boolean;
  majorCategory?: string;
  ieeeMembershipId?: string;
  organizationName?: string;
  position?: string;
  referralSource?: string;
  dataQualityNotes?: string;
}

export const exportColumns = [
  { header: 'ID', key: 'participantId', width: 25 },
  { header: 'Full name', key: 'fullName', width: 32 },
  { header: 'IEEE member', key: 'isIeeeMember', width: 16 },
  { header: 'Role', key: 'role', width: 24 },
  { header: 'University', key: 'universityName', width: 30 },
  { header: 'Attendance', key: 'attendance', width: 20 },
  { header: 'Attended at (UTC)', key: 'attendedAt', width: 26 },
  { header: 'Email address', key: 'email', width: 36 },
  { header: 'Major', key: 'major', width: 25 },
  { header: 'Added at (UTC)', key: 'registeredAt', width: 24 },
  { header: 'Major category', key: 'majorCategory', width: 38 },
  { header: 'IEEE membership ID', key: 'ieeeMembershipId', width: 24 },
  { header: 'Organization', key: 'organizationName', width: 32 },
  { header: 'Position', key: 'position', width: 28 },
  { header: 'Referral source', key: 'referralSource', width: 32 },
  { header: 'Data quality notes', key: 'dataQualityNotes', width: 60 },
];

export function exportValues(row: ExportRegistration) {
  return {
    majorCategory: row.majorCategory ?? 'Not Provided',
    ieeeMembershipId: row.ieeeMembershipId ?? '',
    organizationName: row.organizationName ?? 'Not Provided',
    position: row.position ?? '',
    referralSource: row.referralSource ?? 'Not Provided',
    dataQualityNotes: row.dataQualityNotes ?? '',
    participantId: row.participantId,
    fullName: row.fullName,
    isIeeeMember: row.isIeeeMember ? 'Yes' : 'No',
    role: row.role,
    universityName: row.universityName,
    attendance: row.attendedAt ? 'Attended' : 'Not attended',
    attendedAt: row.attendedAt ? new Date(row.attendedAt) : null,
    email: row.email,
    major: row.major,
    registeredAt: new Date(row.createdAt),
  };
}
