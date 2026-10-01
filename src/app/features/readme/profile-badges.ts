export const badgeMajors = [
  {
    id: 'software',
    name: 'Computer science / Software engineering',
    tools: ['Git', 'Python', 'TypeScript', 'Java', 'PostgreSQL', 'Docker'],
  },
  {
    id: 'ai',
    name: 'Artificial intelligence / Machine learning',
    tools: ['Python', 'PyTorch', 'TensorFlow', 'scikit-learn', 'Jupyter', 'Hugging Face'],
  },
  {
    id: 'data',
    name: 'Data science / Analytics',
    tools: ['Python', 'R', 'pandas', 'NumPy', 'Jupyter', 'PostgreSQL'],
  },
  {
    id: 'frontend',
    name: 'Frontend development',
    tools: ['HTML5', 'CSS', 'JavaScript', 'TypeScript', 'Angular', 'React'],
  },
  {
    id: 'backend',
    name: 'Backend development',
    tools: ['Node.js', 'Python', 'Java', 'Go', 'PostgreSQL', 'Redis', 'Docker'],
  },
  {
    id: 'mobile',
    name: 'Mobile development',
    tools: ['Flutter', 'Dart', 'Kotlin', 'Swift', 'React', 'Firebase'],
  },
  {
    id: 'security',
    name: 'Cybersecurity',
    tools: ['Linux', 'Python', 'Bash', 'Wireshark', 'Kali Linux', 'Git'],
  },
  {
    id: 'cloud',
    name: 'Cloud / DevOps',
    tools: ['Linux', 'Docker', 'Kubernetes', 'Terraform', 'GitHub Actions', 'Bash'],
  },
  {
    id: 'embedded',
    name: 'Computer engineering / Embedded systems',
    tools: ['C', 'C++', 'Python', 'Arduino', 'Raspberry Pi', 'Linux'],
  },
  {
    id: 'qa',
    name: 'Software testing / QA',
    tools: ['TypeScript', 'Python', 'Playwright', 'Cypress', 'Selenium', 'GitHub Actions'],
  },
] as const;

export const badgeCatalog = [...new Set(badgeMajors.flatMap((major) => [...major.tools]))];
export function selectedProfileBadges(values: readonly string[]): string[] {
  return badgeCatalog.filter((name) => values.includes(name));
}
/** Shields static badge syntax: escape dashes and underscores before URL encoding. */
export function profileBadgeUrl(name: string): string {
  const label = encodeURIComponent(name.replace(/_/g, '__').replace(/-/g, '--'));
  return `https://img.shields.io/badge/${label}-25654e?style=for-the-badge`;
}
