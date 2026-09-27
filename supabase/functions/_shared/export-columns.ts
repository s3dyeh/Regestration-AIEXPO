export interface ExportRegistration {
  id: string;
  eventId: string;
  requestId: string;
  createdAt: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  major: string;
  gender: string;
  showName: boolean;
}

export const exportColumns = [
  { header: 'First name', key: 'firstName', width: 25 },
  { header: 'Last name', key: 'lastName', width: 25 },
  { header: 'Full name', key: 'name', width: 32 },
  { header: 'Email address', key: 'email', width: 36 },
  { header: 'Phone number', key: 'localPhone', width: 20 },
  { header: 'Phone (international)', key: 'phone', width: 24 },
  { header: 'Major', key: 'major', width: 25 },
  { header: 'Gender', key: 'gender', width: 20 },
  { header: 'Registered at (UTC)', key: 'registeredAt', width: 24 },
  { header: 'Registration ID', key: 'id', width: 38 },
  { header: 'Event ID', key: 'eventId', width: 38 },
  { header: 'Request ID', key: 'requestId', width: 38 },
  { header: 'Legacy name display flag', key: 'nameDisplay', width: 28 },
];

export function exportValues(row: ExportRegistration) {
  return {
    ...row,
    name: `${row.firstName} ${row.lastName}`.trim(),
    localPhone: /^\+9627[0-9]{8}$/.test(row.phone) ? `0${row.phone.slice(4)}` : row.phone,
    registeredAt: new Date(row.createdAt),
    nameDisplay: row.showName ? 'Yes' : 'No',
  };
}
