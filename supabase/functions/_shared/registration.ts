import { z } from 'zod';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

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

export const registrationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Enter your full name.')
    .max(100, 'Use 100 characters or fewer.')
    .regex(/^[\p{L}\p{M}\s.'’\-]+$/u, 'Use letters, spaces, or name punctuation.')
    .refine(
      (value) => (value.match(/\p{L}/gu) ?? []).length >= 2,
      'Enter at least two letters in your name.',
    )
    .transform((value) => value.normalize('NFC').replace(/\s+/gu, ' ')),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254),
  phone: z
    .string()
    .trim()
    .max(30, 'Use 30 characters or fewer.')
    .transform((value, context) => {
      const phone = parsePhoneNumberFromString(value);
      if (!/^\+[\d\s().-]+$/.test(value) || !phone?.isValid() || phone.ext) {
        context.addIssue({
          code: 'custom',
          message: 'Enter a valid phone number with country code, e.g. +962 79 123 4567.',
        });
        return z.NEVER;
      }
      return phone.number;
    }),
  major: z.enum(MAJORS, { error: 'Choose your major.' }),
  gender: z.enum(GENDERS, { error: 'Choose an option.' }),
  // Retained for compatibility with existing database payloads; no longer user-selectable.
  showName: z
    .boolean()
    .optional()
    .transform(() => true),
});

export const submissionSchema = z.object({
  eventId: z.uuid(),
  requestId: z.uuid(),
  registration: registrationSchema,
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
  return registration.name;
}
