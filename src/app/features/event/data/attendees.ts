import { z } from 'zod';

export const attendeeSchema = z.object({
  id: z.uuid(),
  createdAt: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phone: z.string(),
  major: z.string(),
  gender: z.string(),
});
export const attendeePageSchema = z.object({
  total: z.number().int().nonnegative(),
  rows: z.array(attendeeSchema),
});
export type Attendee = z.infer<typeof attendeeSchema>;
export type AttendeePage = z.infer<typeof attendeePageSchema>;

export function localPhone(phone: string): string {
  return /^\+9627[0-9]{8}$/.test(phone) ? `0${phone.slice(4)}` : phone;
}
