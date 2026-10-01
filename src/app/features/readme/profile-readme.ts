import { profileBadgeUrl, selectedProfileBadges } from './profile-badges';

export interface ProfileProject {
  id: number;
  name: string;
  description: string;
  url: string;
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
  const banner = safeProfileUrl(draft.banner);
  if (banner)
    sections.unshift(
      `![${markdownText(draft.bannerAlt) || 'Profile banner'}](<${banner.replace(/</g, '%3C').replace(/>/g, '%3E')}>)`,
    );
  if (draft.headline.trim()) sections.push(markdownText(draft.headline));
  if (draft.about.trim()) sections.push(`## About me\n\n${markdownText(draft.about)}`);
  const badges = selectedProfileBadges(draft.badges);
  if (badges.length)
    sections.push(
      `## Technology badges\n\n${badges.map((name) => `![${markdownText(name)}](${profileBadgeUrl(name)})`).join(' ')}`,
    );
  const skills = profileSkills(draft.skills);
  if (skills.length)
    sections.push(
      `## Tools and technologies\n\n${skills.map((skill) => '- ' + markdownText(skill)).join('\n')}`,
    );
  if (draft.learning.trim())
    sections.push(`## Currently learning\n\n${markdownText(draft.learning)}`);
  const projects = draft.projects.filter((project) => project.name.trim());
  if (projects.length)
    sections.push(
      `## Selected projects\n\n${projects
        .map((project) => {
          const url = safeProfileUrl(project.url);
          const title = url
            ? `[${markdownText(project.name)}](<${url.replace(/</g, '%3C').replace(/>/g, '%3E')}>)`
            : markdownText(project.name);
          return `### ${title}${project.description.trim() ? '\n\n' + markdownText(project.description) : ''}`;
        })
        .join('\n\n')}`,
    );
  if (draft.collaboration.trim())
    sections.push(`## Let's collaborate\n\n${markdownText(draft.collaboration)}`);
  const website = safeProfileUrl(draft.website);
  if (website)
    sections.push(
      `## Find me online\n\n[My website](<${website.replace(/</g, '%3C').replace(/>/g, '%3E')}>)`,
    );
  return sections.join('\n\n') + '\n';
}
