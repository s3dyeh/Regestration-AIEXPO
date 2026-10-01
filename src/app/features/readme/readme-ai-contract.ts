import { z } from 'zod';

export const aiFields = [
  'headline',
  'about',
  'learning',
  'collaboration',
  'currentWork',
  'highlights',
  'project',
] as const;
export const aiRequestSchema = z
  .object({
    focus: z.string().max(100),
    tone: z.enum(['clear', 'friendly', 'concise']),
    facts: z
      .object({
        headline: z.string().max(180),
        about: z.string().max(3000),
        skills: z.string().max(1000),
        learning: z.string().max(1500),
        collaboration: z.string().max(1500),
        currentWork: z.string().max(1500),
        highlights: z.string().max(2000),
        projects: z
          .array(
            z
              .object({
                id: z.number().int().positive(),
                name: z.string().max(120),
                description: z.string().max(2000),
                outcome: z.string().max(1000),
              })
              .strict(),
          )
          .max(6),
      })
      .strict(),
  })
  .strict();
export const aiResultSchema = z
  .object({
    suggestions: z
      .array(
        z
          .object({
            field: z.enum(aiFields),
            projectId: z.number().int().positive().nullable(),
            value: z.string().min(1).max(1500),
            reason: z.string().min(1).max(240),
          })
          .strict(),
      )
      .max(6),
    note: z.string().max(400),
  })
  .strict();
export type ReadmeAiRequest = z.infer<typeof aiRequestSchema>;
export type ReadmeAiResult = z.infer<typeof aiResultSchema>;
export type ReadmeSuggestion = ReadmeAiResult['suggestions'][number];
