import { profileBadgeUrl, selectedProfileBadges, technologyImageUrl } from './profile-badges';
import { generatedBanner, themeFor, badgeTopic } from './profile-presentation';

export interface ProfileProject {
  id: number;
  name: string;
  description: string;
  url: string;
  outcome?: string;
}
export interface ProfileDraft {
  username: string;
  name: string;
  headline: string;
  about: string;
  skills: string;
  learning: string;
  collaboration: string;
  website: string;
  banner: string;
  bannerAlt: string;
  currentWork: string;
  highlights: string;
  linkedin: string;
  location: string;
  layout: string;
  focus: string;
  theme: string;
  badgeStyle: string;
  badgeFormat: string;
  autoBanner: boolean;
  compact: boolean;
  hidden: string[];
  projects: ProfileProject[];
  badges: string[];
}
export const emptyProfile: ProfileDraft = {
  username: '',
  name: '',
  headline: '',
  about: '',
  skills: '',
  learning: '',
  collaboration: '',
  website: '',
  banner: '',
  bannerAlt: '',
  currentWork: '',
  highlights: '',
  linkedin: '',
  location: '',
  layout: 'classic',
  focus: 'software',
  theme: 'forest',
  badgeStyle: 'for-the-badge',
  badgeFormat: 'logos',
  autoBanner: false,
  compact: false,
  hidden: [],
  projects: [],
  badges: [],
};
export function safeProfileUrl(value: string): string | null {
  if (!value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function markdownText(value: string): string {
  return value
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/([\\`*_{}[\]()#+.!|~-])/g, '\\$1');
}
export function profileSkills(value: string): string[] {
  return [
    ...new Set(
      value
        .split(',')
        .map((skill) => skill.trim())
        .filter(Boolean),
    ),
  ];
}
export function profileReadme(draft: ProfileDraft): string {
  const sections = [`# Hi, I'm ${markdownText(draft.name) || '…'}`];
  const banner = safeProfileUrl(draft.banner) ?? generatedBanner(draft);
  if (banner)
    sections.unshift(
      `![${markdownText(draft.bannerAlt) || 'Profile banner'}](<${banner.replace(/</g, '%3C').replace(/>/g, '%3E')}>)`,
    );
  if (draft.headline.trim()) sections.push(markdownText(draft.headline));
  if (draft.location.trim()) sections.push(`Based in ${markdownText(draft.location)}`);
  if (draft.autoBanner && draft.username)
    sections.push(
      `[![Explore my GitHub](${profileBadgeUrl('Explore my GitHub', themeFor(draft.theme).color, draft.badgeStyle)})](https://github.com/${encodeURIComponent(draft.username)})`,
    );
  const content = profileSections(draft);
  if (draft.layout === 'portfolio' && content.length)
    sections.push(
      content
        .filter((s) => !(draft.compact && ['skills', 'learning', 'highlights'].includes(s.id)))
        .map((s) => `[${s.title}](#${sectionAnchor(s.title)})`)
        .join(' · '),
    );
  for (const section of content) {
    const body =
      section.kind === 'badges'
        ? section.items
            .map((name) =>
              draft.badgeFormat === 'logos'
                ? `<a href="${badgeTopic(name)}"><img src="${technologyImageUrl(name, draft.badgeFormat, themeFor(draft.theme).color, draft.badgeStyle).replace(/&/g, '&amp;')}" alt="${name.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" width="48" height="48" /></a>`
                : `[![${markdownText(name)}](${profileBadgeUrl(name, themeFor(draft.theme).color, draft.badgeStyle)})](${badgeTopic(name)})`,
            )
            .join(' ')
        : section.kind === 'list'
          ? section.items.map((item) => '- ' + markdownText(item)).join('\n')
          : section.kind === 'links'
            ? section.links
                .map(
                  (link) =>
                    `[${link.label}](<${link.url.replace(/</g, '%3C').replace(/>/g, '%3E')}>)`,
                )
                .join(' · ')
            : section.kind === 'projects'
              ? section.projects
                  .map((project) => {
                    const title = project.link
                      ? `[${markdownText(project.name)}](<${project.link.replace(/</g, '%3C').replace(/>/g, '%3E')}>)`
                      : markdownText(project.name);
                    return `### ${title}${project.description.trim() ? '\n\n' + markdownText(project.description) : ''}${project.outcome?.trim() ? '\n\n**Outcome:** ' + markdownText(project.outcome) : ''}`;
                  })
                  .join('\n\n')
              : markdownText(section.text);
    sections.push(
      draft.compact && ['skills', 'learning', 'highlights'].includes(section.id)
        ? `<details>\n<summary>${section.title}</summary>\n\n${body}\n\n</details>`
        : `## ${section.title}\n\n${body}`,
    );
  }
  return sections.join('\n\n') + '\n';
}

export const sectionLabels = {
  about: 'About me',
  currentWork: 'Currently building',
  projects: 'Selected projects',
  highlights: 'Highlights',
  badges: 'Technology badges',
  skills: 'Tools and technologies',
  learning: 'Currently learning',
  collaboration: "Let's collaborate",
  links: 'Find me online',
};
export type SectionId = keyof typeof sectionLabels;
export function sectionAnchor(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/ /g, '-');
}
export interface ProfileSection {
  id: SectionId;
  title: string;
  kind: 'text' | 'list' | 'badges' | 'projects' | 'links';
  text: string;
  items: string[];
  projects: (ProfileProject & { link: string | null })[];
  links: { label: string; url: string }[];
}
export function profileSections(draft: ProfileDraft): ProfileSection[] {
  const order: SectionId[] =
    draft.layout === 'portfolio'
      ? [
          'about',
          'projects',
          'highlights',
          'currentWork',
          'badges',
          'skills',
          'learning',
          'collaboration',
          'links',
        ]
      : [
          'about',
          'currentWork',
          'badges',
          'skills',
          'learning',
          'projects',
          'highlights',
          'collaboration',
          'links',
        ];
  return order
    .filter((id) => !draft.hidden.includes(id))
    .map((id) => {
      const section: ProfileSection = {
        id,
        title: sectionLabels[id],
        kind: 'text',
        text: '',
        items: [],
        projects: [],
        links: [],
      };
      if (id === 'projects') {
        section.kind = 'projects';
        section.projects = draft.projects
          .filter((p) => p.name.trim())
          .map((p) => ({ ...p, link: safeProfileUrl(p.url) }));
      } else if (id === 'badges') {
        section.kind = 'badges';
        section.items = selectedProfileBadges(draft.badges);
      } else if (id === 'skills' || id === 'highlights') {
        section.kind = 'list';
        section.items =
          id === 'skills'
            ? profileSkills(draft.skills)
            : draft.highlights
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean);
      } else if (id === 'links') {
        section.kind = 'links';
        for (const [label, raw] of [
          ['My website', draft.website],
          ['LinkedIn', draft.linkedin],
        ]) {
          const url = safeProfileUrl(raw);
          if (url) section.links.push({ label, url });
        }
      } else section.text = draft[id];
      return section;
    })
    .filter((s) => s.text.trim() || s.items.length || s.projects.length || s.links.length);
}
