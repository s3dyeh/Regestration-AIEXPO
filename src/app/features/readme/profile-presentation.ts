import { profileBannerSvg } from './profile-banner';
import type { ProfileDraft } from './profile-readme';

export const profileThemes = [
  {
    id: 'forest',
    name: 'Botanical',
    description: 'Calm greens. Thoughtful builder.',
    color: '25654e',
    background: '102f28',
    accent: '77dfba',
  },
  {
    id: 'midnight',
    name: 'After hours',
    description: 'Deep navy. Electric blue.',
    color: '335fcc',
    background: '101b36',
    accent: '91b8ff',
  },
  {
    id: 'sunrise',
    name: 'Daybreak',
    description: 'Warm copper. Bright ideas.',
    color: '9b441d',
    background: '3f2218',
    accent: 'ffbb82',
  },
] as const;
export function themeFor(id: string) {
  return profileThemes.find((theme) => theme.id === id) ?? profileThemes[0];
}
export function generatedBanner(draft: ProfileDraft): string | null {
  if (!draft.autoBanner) return null;
  const theme = themeFor(draft.theme);
  const query = new URLSearchParams({
    type: 'waving',
    color: theme.background,
    height: '240',
    section: 'header',
    text: (draft.name || draft.username || 'Hello, world').slice(0, 40),
    fontColor: theme.accent,
    fontSize: '44',
    fontAlignY: '36',
    desc: (draft.headline || 'Learn. Build. Share.').slice(0, 75),
    descSize: '17',
    descAlignY: '58',
  });
  return `https://aiexpo.s3dyeh.com/api/readme-banner?${query}`;
}
export function badgeTopic(name: string): string {
  const topics: Record<string, string> = {
    'C++': 'cpp',
    'Node.js': 'nodejs',
    'Hugging Face': 'huggingface',
    'GitHub Actions': 'github-actions',
  };
  return `https://github.com/topics/${topics[name] ?? name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

export function generatedBannerPreview(draft: ProfileDraft): string | null {
  if (!draft.autoBanner) return null;
  const theme = themeFor(draft.theme);
  return (
    'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(
      profileBannerSvg(
        draft.name || draft.username,
        draft.headline,
        theme.background,
        theme.accent,
      ),
    )
  );
}
