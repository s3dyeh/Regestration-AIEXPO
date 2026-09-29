import { expect, type Page } from '@playwright/test';
export interface ParticipantFields {
  id: string;
  name: string;
  email: string;
  role: string;
  university: string;
  major: string;
  member: boolean;
}
export async function fillParticipant(page: Page, fields: Partial<ParticipantFields> = {}) {
  const person = {
    id: '001',
    name: 'أحمد سعدية',
    email: 'ahmad@example.com',
    role: 'Student',
    university: 'University of Jordan',
    major: 'Engineering',
    member: true,
    ...fields,
  };
  for (const [label, value] of Object.entries({
    'Participant ID': person.id,
    'Full name': person.name,
    'Email address': person.email,
    Role: person.role,
    'University (optional)': person.university,
    'Major (optional)': person.major,
  }))
    await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByLabel('IEEE member', { exact: true }).setChecked(person.member);
  return person;
}
export async function registerParticipant(page: Page, fields: Partial<ParticipantFields> = {}) {
  const person = await fillParticipant(page, fields);
  await page.getByRole('button', { name: 'Register participant', exact: true }).click();
  await expect(
    page.getByRole('status').filter({
      hasText: `Participant ${/^[0-9]{1,2}$/.test(person.id) ? person.id.padStart(3, '0') : person.id} registered.`,
    }),
  ).toBeVisible();
}
