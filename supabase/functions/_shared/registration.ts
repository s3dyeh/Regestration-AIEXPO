import { z } from 'zod';

export const MAJORS = [
  'Computer Science',
  'Engineering',
  'Business',
  'Medicine',
  'Arts & Humanities',
  'Science',
  'Other',
] as const;
export const GENDERS = ['Female', 'Male'] as const;

function nameSchema(label: string) {
  return z
    .string({ error: `Enter your ${label}.` })
    .trim()
    .min(1, `Enter your ${label}.`)
    .max(49, 'Use 49 characters or fewer.')
    .regex(/^[\p{L}\p{M}\s.'’\-]+$/u, 'Use letters, spaces, or name punctuation.')
    .refine((value) => /\p{L}/u.test(value), 'Enter at least one letter in your name.')
    .transform((value) => value.normalize('NFC').replace(/\s+/gu, ' '));
}

export const registrationSchema = z.object({
  firstName: nameSchema('first name'),
  lastName: nameSchema('last name'),
  email: z.string({ error: 'Enter your email address.' }).trim().toLowerCase().email('Enter a valid email address.').max(254),
  phone: z
    .string({ error: 'Enter your Jordanian phone number.' })
    .trim()
    .regex(/^07[0-9]{8}$/, 'Enter 10 digits starting with 07, e.g. 0790000000.'),
  major: z.enum(MAJORS, { error: 'Choose your major.' }),
  gender: z.enum(GENDERS, { error: 'Choose an option.' }),
  // Retained for compatibility with existing database payloads; no longer user-selectable.
  showName: z
    .boolean()
    .optional()
    .transform(() => true),
});

// Accept earlier clients during deployment; the form still uses the strict schema above.
export function normalizeRegistrationPayload(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const fields = value as Record<string, unknown>;
  const legacyName = typeof fields['name'] === 'string' ? fields['name'].trim().replace(/\s+/gu, ' ') : '';
  const separator = legacyName.indexOf(' ');
  const phone = typeof fields['phone'] === 'string' ? fields['phone'].trim() : fields['phone'];
  const international = typeof phone === 'string' ? phone.replace(/[\s().-]/g, '') : '';
  return {
    ...fields,
    firstName: fields['firstName'] ?? fields['FNAME'] ?? (legacyName ? (separator < 0 ? legacyName : legacyName.slice(0, separator)) : undefined),
    lastName: fields['lastName'] ?? fields['LNAME'] ?? (separator < 0 ? undefined : legacyName.slice(separator + 1)),
    phone: /^\+9627[0-9]{8}$/.test(international) ? `0${international.slice(4)}` : phone,
  };
}

export const submissionSchema = z.object({
  eventId: z.uuid({ error: 'The event ID is missing or invalid. Refresh the page and try again.' }),
  requestId: z.uuid({ error: 'The registration request ID is missing or invalid. Refresh the page and try again.' }),
  registration: z.preprocess(normalizeRegistrationPayload, registrationSchema),
});

export type Registration = z.infer<typeof registrationSchema>;
export type Submission = z.infer<typeof submissionSchema>;
export const welcomeSchema = z.object({
  id: z.uuid(),
  displayName: z.string().max(100).nullable(),
  createdAt: z.iso.datetime({ offset: true }),
});
export type WelcomeEvent = z.infer<typeof welcomeSchema>;
export const statsSchema = z.object({
  total: z.number().int().nonnegative(),
  majors: z.array(z.object({ name: z.string(), count: z.number().int().nonnegative() })),
  genders: z.array(z.object({ name: z.string(), count: z.number().int().nonnegative() })),
  timeline: z.array(z.object({ time: z.string(), count: z.number().int().nonnegative() })),
  recentCount: z.number().int().nonnegative().default(0),
  recent: z.array(welcomeSchema).default([]),
});
export type EventStats = z.infer<typeof statsSchema>;
export const emptyStats = (): EventStats => ({
  total: 0,
  majors: [],
  genders: [],
  timeline: [],
  recentCount: 0,
  recent: [],
});

export function displayName(registration: Registration): string | null {
  return `${registration.firstName} ${registration.lastName}`;
}

// Store each name independently; only phone representation changes at this boundary.
export function databaseRegistration(registration: Registration) {
  const { firstName, lastName, phone, ...details } = registration;
  return { ...details, FNAME: firstName, LNAME: lastName, phone: `+962${phone.slice(1)}` };
}
