import { z } from 'zod';
import { emptyProfile, safeProfileUrl, sectionLabels } from './profile-readme';
import type { ProfileDraft } from './profile-readme';
export const draftKey = 'careerlens.readme.v1';
const text = (max: number) => z.string().max(max);
export const workspaceSchema = z.object({
  version: z.literal(1),
  draft: z.object({
    username: text(39),
    name: text(100),
    headline: text(180),
    about: text(3000),
    skills: text(1000),
    learning: text(1500),
    collaboration: text(1500),
    website: text(2000),
    banner: text(2000),
    bannerAlt: text(250),
    currentWork: text(1500),
    highlights: text(2000),
    linkedin: text(2000),
    location: text(100),
    layout: z.enum(['classic', 'portfolio']),
    focus: text(100).default('software'),
    theme: z.enum(['forest', 'midnight', 'sunrise']).default('forest'),
    badgeFormat: z.enum(['logos', 'labels']).default('logos'),
    badgeStyle: z
      .enum(['for-the-badge', 'flat', 'flat-square', 'plastic'])
      .default('for-the-badge'),
    autoBanner: z.boolean().default(false),
    compact: z.boolean().default(false),
    hidden: z
      .array(
        z.enum(
          Object.keys(sectionLabels) as [
            keyof typeof sectionLabels,
            ...(keyof typeof sectionLabels)[],
          ],
        ),
      )
      .max(9),
    badges: z.array(text(80)).max(60),
    projects: z
      .array(
        z.object({
          id: z.number().int().positive(),
          name: text(120),
          description: text(2000),
          url: text(2000),
          outcome: text(1000).optional(),
        }),
      )
      .max(6),
  }),
});
export function restoreDraft(raw: string | null): ProfileDraft {
  if (!raw || raw.length > 150000) return structuredClone(emptyProfile);
  try {
    const result = workspaceSchema.safeParse(JSON.parse(raw));
    if (result.success)
      return {
        ...result.data.draft,
        projects: result.data.draft.projects.map((p, i) => ({ ...p, id: i + 1 })),
      };
  } catch {
    /* Recover with an empty draft. */
  }
  return structuredClone(emptyProfile);
}
export function readmeChecklist(draft: ProfileDraft) {
  return [
    {
      label: 'Introduce yourself with a clear headline',
      done: !!draft.name.trim() && !!draft.headline.trim(),
      field: 'profile-headline',
    },
    {
      label: 'Explain what you care about and build',
      done: draft.about.trim().length >= 60,
      field: 'profile-about',
    },
    {
      label: 'Include a project with a description and link',
      done: draft.projects.some(
        (p) => p.name.trim() && p.description.trim().length >= 30 && safeProfileUrl(p.url),
      ),
      field: 'projects-heading',
    },
    {
      label: 'Describe your contribution or an outcome',
      done: draft.projects.some((p) => !!p.outcome?.trim()),
      field: 'projects-heading',
    },
    {
      label: 'Show your tools and next learning goal',
      done: !!(draft.skills.trim() || draft.badges.length) && !!draft.learning.trim(),
      field: 'profile-learning',
    },
    {
      label: 'Give visitors a way to connect',
      done: !!(safeProfileUrl(draft.website) || safeProfileUrl(draft.linkedin)),
      field: 'profile-website',
    },
  ];
}
