import type { RepositoryEvidence } from './github-analysis';
import type { ContentSample } from './github-score';
export const CAREER_PATH_VERSION = '1.0';
export interface TechnologyEvidence {
  name: string;
  path: string;
  url: string;
}
// Narrow import signatures in sampled source only, never README keywords or language guesses.
export function detectTechnologyImports(samples: ContentSample[]): TechnologyEvidence[] {
  const packages: [string, string][] = [
    ['openai', 'LLM SDK'],
    ['anthropic', 'LLM SDK'],
    ['langchain', 'LLM orchestration'],
    ['llama_index', 'LLM orchestration'],
    ['sklearn', 'ML library'],
    ['torch', 'ML library'],
    ['tensorflow', 'ML library'],
    ['pandas', 'Data library'],
    ['numpy', 'Data library'],
  ];
  return samples.flatMap((sample) =>
    packages
      .filter(([name]) =>
        new RegExp(
          `^\\s*(?:from\\s+${name}(?:[.\\s])|import\\s+${name}(?:[.\\s]|$)|import\\s+[^\\n]*from\\s*['"]${name}(?:[/.'"])|(?:const|let|var)\\s+[^\\n]*require\\(['"]${name}['"]\\))`,
          'm',
        ).test(sample.text ?? ''),
      )
      .map(([, name]) => ({ name, path: sample.path, url: sample.url })),
  );
}
interface Milestone {
  id: string;
  title: string;
  requires: string[];
  roadmap: string;
  deliverable: string;
  skills?: string[];
  checks?: string[];
  technologies?: string[];
}
const node = (
  id: string,
  title: string,
  requires: string[],
  roadmap: string,
  deliverable: string,
  evidence: Pick<Milestone, 'skills' | 'checks' | 'technologies'> = {},
): Milestone => ({
  id,
  title,
  requires,
  roadmap: `https://roadmap.sh/${roadmap}`,
  deliverable,
  ...evidence,
});
const milestones: Milestone[] = [
  node(
    'programming',
    'Programming foundations',
    [],
    'computer-science',
    'Build a small program with explicit inputs, error handling and documented time/space complexity.',
    {
      skills: [
        'JavaScript',
        'TypeScript',
        'Python',
        'Go',
        'Java',
        'C#',
        'Rust',
        'C++',
        'C',
        'Ruby',
        'PHP',
        'Kotlin',
        'Swift',
      ],
    },
  ),
  node(
    'python',
    'Python for data and models',
    [],
    'python',
    'Package a Python data-processing script with validation, a reproducible environment and examples.',
    { skills: ['Python'] },
  ),
  node(
    'git',
    'Git and reproducible project setup',
    [],
    'git-github',
    'Demonstrate a branch, a reviewed change, conflict resolution and setup from a fresh clone.',
    { checks: ['Specific commit subjects', 'Setup instructions'] },
  ),
  node(
    'tests',
    'Testing and failure cases',
    ['programming', 'git'],
    'qa',
    'Write automated tests for normal, boundary and failure cases; document one defect they catch.',
    { checks: ['Automated test files', 'Testing instructions'] },
  ),
  node(
    'design',
    'Software design and architecture',
    ['programming'],
    'software-design-architecture',
    'Separate domain logic from infrastructure and record a design decision with alternatives.',
    { checks: ['Architecture'] },
  ),
  node(
    'delivery',
    'Automated delivery and operations',
    ['tests'],
    'devops',
    'Run tests in CI, deploy a versioned build and rehearse rollback; include health checks and logs.',
    { checks: ['CI configuration', 'Observed workflow outcomes'] },
  ),
  node(
    'security',
    'Security and trust boundaries',
    ['design'],
    'backend',
    'Threat-model the project; test authorization and validation, keep secrets out of source, document responsible reporting.',
    { checks: ['Security reporting policy'] },
  ),
  node(
    'data',
    'Data modeling and persistence',
    ['programming'],
    'sql',
    'Design a schema, migrations and indexed queries; test transactions and explain access patterns.',
  ),
  node(
    'api',
    'API contracts and service behavior',
    ['data', 'tests'],
    'backend',
    'Build a versioned API with authorization, pagination, validation and failure-path integration tests.',
  ),
  node(
    'ui',
    'Accessible frontend applications',
    ['programming'],
    'frontend',
    'Build responsive forms with semantic HTML, keyboard navigation, loading and error states.',
    { skills: ['HTML', 'CSS', 'Angular', 'Next.js'] },
  ),
  node(
    'ui-testing',
    'Browser behavior and accessibility verification',
    ['ui', 'tests'],
    'qa',
    'Automate a real user journey, verify keyboard/focus behavior and document accessibility checks.',
  ),
  node(
    'systems',
    'System design and reliability',
    ['api', 'design', 'delivery'],
    'system-design',
    'Load-test a service, identify a bottleneck and justify caching, queues and consistency tradeoffs.',
  ),
  node(
    'llm',
    'Model APIs and structured responses',
    ['programming', 'git'],
    'ai-engineer',
    'Build a model API client with schema validation, timeouts, retries, cost limits and a mocked test suite.',
    { technologies: ['LLM SDK', 'LLM orchestration'] },
  ),
  node(
    'retrieval',
    'Retrieval and grounded answers',
    ['llm', 'data'],
    'ai-engineer',
    'Build retrieval over a permission-scoped document set; cite sources and measure retrieval quality.',
  ),
  node(
    'ai-eval',
    'AI evaluation, safety and failure analysis',
    ['retrieval', 'tests', 'security'],
    'ai-engineer',
    'Create a held-out evaluation set; test hallucinations, prompt injection, data leakage and tool permissions. Compare a baseline and report latency/cost.',
  ),
  node(
    'statistics',
    'Statistics and experimental design',
    ['python'],
    'ai-data-scientist',
    'Explain sampling, uncertainty, leakage and train/validation/test separation using a reproducible experiment.',
  ),
  node(
    'ml',
    'Model training and baselines',
    ['statistics'],
    'ai-data-scientist',
    'Train a baseline and a second model; compare suitable metrics, class imbalance and cross-validation without test leakage.',
    { technologies: ['ML library', 'Data library'] },
  ),
  node(
    'ml-eval',
    'Model evaluation and monitoring',
    ['ml', 'tests'],
    'ai-data-scientist',
    'Version data/model artifacts, measure subgroup errors and drift, document limitations and retraining triggers.',
  ),
  node(
    'infra',
    'Infrastructure and observability',
    ['delivery', 'security'],
    'devops',
    'Provision a reproducible environment and exercise alerting, least privilege, backup and recovery.',
    { skills: ['Docker'] },
  ),
  node(
    'qa-strategy',
    'Risk-based test strategy',
    ['ui-testing', 'api'],
    'qa',
    'Create a risk matrix covering exploratory, API, UI, performance and security tests with explicit release criteria.',
  ),
];
export const careerFocuses = [
  {
    id: 'software',
    name: 'Software Engineer',
    roadmap: 'software-design-architecture',
    targets: ['systems', 'security'],
    project:
      'Build a service with persistent data, a documented architecture, tests, CI and a load-test report.',
  },
  {
    id: 'ai',
    name: 'AI Engineer',
    roadmap: 'ai-engineer',
    targets: ['ai-eval', 'delivery'],
    project:
      'Ship a grounded assistant with source citations, permission checks, adversarial evaluations, cost tracking and an operational runbook.',
  },
  {
    id: 'ml',
    name: 'ML / Data Science Engineer',
    roadmap: 'ai-data-scientist',
    targets: ['ml-eval', 'delivery'],
    project:
      'Deliver a reproducible training pipeline, baseline comparison, model card, inference endpoint and monitoring plan.',
  },
  {
    id: 'frontend',
    name: 'Frontend Developer',
    roadmap: 'frontend',
    targets: ['ui-testing', 'delivery'],
    project:
      'Ship an accessible application with real API integration, resilient UI states and browser tests.',
  },
  {
    id: 'backend',
    name: 'Backend Developer',
    roadmap: 'backend',
    targets: ['api', 'security', 'delivery'],
    project:
      'Ship an authenticated API with migrations, transactional tests, rate limits and observability.',
  },
  {
    id: 'devops',
    name: 'DevOps Engineer',
    roadmap: 'devops',
    targets: ['infra'],
    project:
      'Automate provisioning, deployment, monitoring and recovery with a documented failure drill.',
  },
  {
    id: 'qa',
    name: 'QA / Software Testing Engineer',
    roadmap: 'qa',
    targets: ['qa-strategy', 'delivery'],
    project:
      'Build a layered test portfolio and CI pipeline, including defect reports and release-risk analysis.',
  },
] as const;
export type FocusId = (typeof careerFocuses)[number]['id'];
export function isFocusId(value: string): value is FocusId {
  return careerFocuses.some((focus) => focus.id === value);
}
export interface PathStep extends Milestone {
  status: 'observed' | 'needs-work' | 'unknown';
  reason: string;
  evidence: { label: string; url: string }[];
  completed: boolean;
  blockedBy: string[];
}
export function buildCareerPlan(
  focusId: FocusId,
  repositories: RepositoryEvidence[],
  completedIds: readonly string[] = [],
) {
  const focus = careerFocuses.find((item) => item.id === focusId)!;
  const selected = new Map<string, Milestone>();
  const visit = (id: string) => {
    if (selected.has(id)) return;
    const item = milestones.find((milestone) => milestone.id === id);
    if (!item) throw new Error(`Unknown prerequisite: ${id}`);
    selected.set(id, item);
    item.requires.forEach(visit);
  };
  focus.targets.forEach(visit);
  const evidenceFor = (item: Milestone) => {
    const evidence: PathStep['evidence'] = [];
    let gaps = 0;
    for (const repo of repositories) {
      for (const skill of item.skills ?? [])
        if (repo.skills.includes(skill))
          evidence.push({ label: `${repo.name}: ${skill} metadata/configuration`, url: repo.url });
      for (const tech of repo.technologyEvidence ?? [])
        if (item.technologies?.includes(tech.name))
          evidence.push({
            label: `${repo.name}: ${tech.name} import in ${tech.path}`,
            url: tech.url,
          });
      for (const check of repo.categories.flatMap((category) => category.checks)) {
        if (!check.applicable || !item.checks?.includes(check.label)) continue;
        if (check.value === 1)
          evidence.push({ label: `${repo.name}: ${check.label}`, url: check.url });
        else if (check.value !== null) gaps++;
      }
    }
    const status: PathStep['status'] = gaps
      ? 'needs-work'
      : evidence.length
        ? 'observed'
        : 'unknown';
    return {
      evidence,
      status,
      reason: gaps
        ? `${gaps} related repository checks need work. Positive evidence elsewhere does not erase these gaps.`
        : evidence.length
          ? 'Related evidence was observed; demonstrate the milestone before marking it complete. This does not prove mastery.'
          : 'No direct evidence in this sample. Validate your existing knowledge or use the project exercise; absence does not mean no skill.',
    };
  };
  const pending = [...selected.values()].map((item) => ({ ...item, ...evidenceFor(item) }));
  const ordered: PathStep[] = [];
  const priority = { 'needs-work': 0, unknown: 1, observed: 2 };
  while (pending.length) {
    const ready = pending
      .filter((item) => item.requires.every((id) => ordered.some((step) => step.id === id)))
      .sort((a, b) => priority[a.status] - priority[b.status] || a.id.localeCompare(b.id));
    const item = ready[0];
    if (!item) throw new Error('Career path prerequisites contain a cycle.');
    const blockedBy = item.requires.filter(
      (id) => !ordered.find((step) => step.id === id)?.completed,
    );
    ordered.push({
      ...item,
      blockedBy,
      completed: completedIds.includes(item.id) && blockedBy.length === 0,
    });
    pending.splice(
      pending.findIndex((step) => step.id === item.id),
      1,
    );
  }
  return {
    version: CAREER_PATH_VERSION,
    focus: { ...focus, roadmap: `https://roadmap.sh/${focus.roadmap}` },
    steps: ordered,
    next: ordered.filter((step) => !step.completed && !step.blockedBy.length).slice(0, 3),
    completed: ordered.filter((step) => step.completed).length,
    observed: ordered.filter((step) => step.status === 'observed').length,
  };
}
export function updateMilestones(
  plan: ReturnType<typeof buildCareerPlan>,
  id: string,
  done: boolean,
): string[] {
  const item = plan.steps.find((step) => step.id === id);
  const completed = new Set(plan.steps.filter((step) => step.completed).map((step) => step.id));
  if (!item || (done && item.blockedBy.length)) return [...completed];
  if (done) completed.add(id);
  else {
    const removed = new Set([id]);
    for (const step of plan.steps)
      if (removed.has(step.id) || step.requires.some((parent) => removed.has(parent))) {
        removed.add(step.id);
        completed.delete(step.id);
      }
  }
  return [...completed];
}
