import { z } from 'zod';

export const generationRequestSchema = z
  .object({
    mode: z.literal('generate'),
    name: z.string().trim().min(1).max(100),
    username: z
      .string()
      .regex(/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i)
      .refine((value) => !value.includes('--')),
    focus: z.string().trim().min(1).max(100),
    includeProjects: z.boolean().default(true),
  })
  .strict();
export const generatedContentSchema = z
  .object({
    headline: z.string().max(180),
    about: z.string().max(3000),
    currentWork: z.string().max(1500),
    highlights: z.string().max(2000),
    learning: z.string().max(1500),
    collaboration: z.string().max(1500),
    skills: z.array(z.string().max(80)).max(20),
    projects: z
      .array(
        z
          .object({
            id: z.number().int().positive(),
            description: z.string().max(2000),
            outcome: z.string().max(1000),
          })
          .strict(),
      )
      .max(3),
  })
  .strict();
export const generationResponseSchema = z
  .object({
    content: generatedContentSchema,
    repositories: z
      .array(z.object({ id: z.number().int().positive(), name: z.string(), url: z.string().url() }))
      .max(3),
    badges: z.array(z.string()).max(60),
    location: z.string().max(100),
    website: z.string().max(2000),
    note: z.string(),
  })
  .strict();
export type GenerationRequest = z.infer<typeof generationRequestSchema>;
