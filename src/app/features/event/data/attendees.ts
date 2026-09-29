import { z } from 'zod';

export const attendeeSchema = z.object({
  id: z.uuid(),
  createdAt: z.string(),
  fullName: z.string(),
  participantId: z.string(),
  isIeeeMember: z.boolean(),
  role: z.string(),
  universityName: z.string(),
  attendedAt: z.string().nullable(),
  email: z.string(),
  major: z.string(),
  gender: z.string(),
  majorCategory: z.string().optional(),
  ieeeMembershipId: z.string().optional(),
  organizationName: z.string().optional(),
  position: z.string().optional(),
  referralSource: z.string().optional(),
  dataQualityNotes: z.string().optional(),
});
export const attendeePageSchema = z.object({
  total: z.number().int().nonnegative(),
  rows: z.array(attendeeSchema),
});
export type Attendee = z.infer<typeof attendeeSchema>;
export type AttendeePage = z.infer<typeof attendeePageSchema>;
