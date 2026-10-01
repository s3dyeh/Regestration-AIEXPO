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
export const linkedInLogoUrl = 'https://skillicons.dev/icons?i=linkedin&theme=light';
const skillIcons: Record<string, string> = {
  Git: 'git',
  Python: 'py',
  TypeScript: 'ts',
  Java: 'java',
  PostgreSQL: 'postgres',
  Docker: 'docker',
  PyTorch: 'pytorch',
  TensorFlow: 'tensorflow',
  'scikit-learn': 'sklearn',
  R: 'r',
  HTML5: 'html',
  CSS: 'css',
  JavaScript: 'js',
  Angular: 'angular',
  React: 'react',
  'Node.js': 'nodejs',
  Go: 'go',
  Redis: 'redis',
  Flutter: 'flutter',
  Dart: 'dart',
  Kotlin: 'kotlin',
  Swift: 'swift',
  Firebase: 'firebase',
  Linux: 'linux',
  Bash: 'bash',
  'Kali Linux': 'kali',
  Kubernetes: 'kubernetes',
  Terraform: 'terraform',
  'GitHub Actions': 'githubactions',
  C: 'c',
  'C++': 'cpp',
  Arduino: 'arduino',
  'Raspberry Pi': 'raspberrypi',
  Cypress: 'cypress',
  Selenium: 'selenium',
};
const otherIcons: Record<string, string> = {
  Jupyter:
    'https://cdn.jsdelivr.net/gh/devicons/devicon@v2.17.0/icons/jupyter/jupyter-original.svg',
  pandas: 'https://cdn.jsdelivr.net/gh/devicons/devicon@v2.17.0/icons/pandas/pandas-original.svg',
  NumPy: 'https://cdn.jsdelivr.net/gh/devicons/devicon@v2.17.0/icons/numpy/numpy-original.svg',
  Playwright:
    'https://cdn.jsdelivr.net/gh/devicons/devicon@v2.17.0/icons/playwright/playwright-original.svg',
  'Hugging Face': 'https://cdn.simpleicons.org/huggingface/FFD21E',
  Wireshark: 'https://cdn.simpleicons.org/wireshark/1679A7',
};
export function frameworkLogoUrl(name: string): string {
  const icon = skillIcons[name];
  return icon ? `https://skillicons.dev/icons?i=${icon}&theme=light` : (otherIcons[name] ?? '');
}
export function technologyImageUrl(
  name: string,
  format: string,
  color: string,
  style: string,
): string {
  return format === 'logos' ? frameworkLogoUrl(name) : profileBadgeUrl(name, color, style);
}
export function selectedProfileBadges(values: readonly string[]): string[] {
  return badgeCatalog.filter((name) => values.includes(name));
}
/** Shields static badge syntax: escape dashes and underscores before URL encoding. */
export function profileBadgeUrl(name: string, color = '25654e', style = 'for-the-badge'): string {
  const label = encodeURIComponent(name.replace(/_/g, '__').replace(/-/g, '--'));
  const safeColor = /^[0-9a-f]{6}$/i.test(color) ? color : '25654e';
  const safeStyle = ['for-the-badge', 'flat', 'flat-square', 'plastic'].includes(style)
    ? style
    : 'for-the-badge';
  const logos: Record<string, string> = {
    Python: 'python',
    TypeScript: 'typescript',
    JavaScript: 'javascript',
    Git: 'git',
    Docker: 'docker',
    React: 'react',
    Angular: 'angular',
    PyTorch: 'pytorch',
    TensorFlow: 'tensorflow',
    'scikit-learn': 'scikitlearn',
    Jupyter: 'jupyter',
    'Hugging Face': 'huggingface',
    PostgreSQL: 'postgresql',
    Linux: 'linux',
    'Node.js': 'nodedotjs',
    Flutter: 'flutter',
    Kotlin: 'kotlin',
    Swift: 'swift',
    Redis: 'redis',
    Kubernetes: 'kubernetes',
    Terraform: 'terraform',
    'GitHub Actions': 'githubactions',
    'Explore my GitHub': 'github',
  };
  const logo = logos[name];
  return `https://img.shields.io/badge/${label}-${safeColor}?style=${safeStyle}${logo ? '&logo=' + logo + '&logoColor=white' : ''}`;
}
