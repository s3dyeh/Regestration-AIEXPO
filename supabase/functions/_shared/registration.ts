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

const text = (max: number) => z.string().trim().min(1).max(max);
export const registrationSchema = z.object({
  participantId: text(100),
  fullName: text(100),
  email: z.string().trim().toLowerCase().email().max(254),
  isIeeeMember: z.boolean(),
  role: text(100),
  universityName: text(200),
  major: text(200),
  gender: text(100),
  majorCategory: z.string().trim().max(200).optional(),
  ieeeMembershipId: z.string().trim().max(100).optional(),
  organizationName: z.string().trim().max(200).optional(),
  position: z.string().trim().max(200).optional(),
  referralSource: z.string().trim().max(200).optional(),
  dataQualityNotes: z.string().trim().max(2000).optional(),
});
export const submissionSchema = z.object({
  eventId: z.uuid(),
  requestId: z.uuid(),
  participantId: text(100),
});
export type Registration = z.infer<typeof registrationSchema>;
export type Submission = z.infer<typeof submissionSchema>;
export const welcomeSchema = z.object({
  id: z.uuid(),
  alreadyAttended: z.boolean().optional(),
  displayName: z.string().max(100).nullable(),
  createdAt: z.iso.datetime({ offset: true }),
});
export type WelcomeEvent = z.infer<typeof welcomeSchema>;
export const DIMENSIONS = [
  'universities',
  'roles',
  'majors',
  'majorCategories',
  'referrals',
  'organizations',
] as const;
export type Dimension = (typeof DIMENSIONS)[number];
const cohortRowSchema = z.object({
  name: z.string(),
  registered: z.number().int().nonnegative(),
  attended: z.number().int().nonnegative(),
  registeredMembers: z.number().int().nonnegative(),
  members: z.number().int().nonnegative(),
});
export type CohortRow = z.infer<typeof cohortRowSchema>;
const audienceSchema = z.object({
  registeredTotal: z.number().int().nonnegative(),
  registeredMembers: z.number().int().nonnegative(),
  flaggedRecords: z.number().int().nonnegative(),
  // Strip legacy dimensions returned by older database functions.
  dimensions: z.object({
    universities: z.array(cohortRowSchema),
    roles: z.array(cohortRowSchema),
    majors: z.array(cohortRowSchema),
    majorCategories: z.array(cohortRowSchema),
    referrals: z.array(cohortRowSchema),
    organizations: z.array(cohortRowSchema),
  }),
});
export const statsSchema = z.object({
  audience: audienceSchema,
  total: z.number().int().nonnegative(),
  ieeeMembers: z.number().int().nonnegative(),
  universities: z.array(z.object({ name: z.string(), count: z.number().int().nonnegative() })),
  roles: z.array(z.object({ name: z.string(), count: z.number().int().nonnegative() })),
  majors: z.array(z.object({ name: z.string(), count: z.number().int().nonnegative() })),
  timeline: z.array(z.object({ time: z.string(), count: z.number().int().nonnegative() })),
  recentCount: z.number().int().nonnegative().default(0),
  recent: z.array(welcomeSchema).default([]),
});
export type EventStats = z.infer<typeof statsSchema>;
export const emptyStats = (): EventStats => ({
  audience: {
    registeredTotal: 0,
    registeredMembers: 0,
    flaggedRecords: 0,
    dimensions: {
      universities: [],
      roles: [],
      majors: [],
      majorCategories: [],
      referrals: [],
      organizations: [],
    },
  },
  total: 0,
  ieeeMembers: 0,
  universities: [],
  roles: [],
  majors: [],
  timeline: [],
  recentCount: 0,
  recent: [],
});

export function displayName(registration: Registration): string {
  return registration.fullName;
}
export function databaseRegistration(registration: Registration) {
  return registration;
}
