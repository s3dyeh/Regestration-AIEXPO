import {
  buildCareerPlan,
  careerFocuses,
  detectTechnologyImports,
  updateMilestones,
} from './career-path';
import type { RepositoryEvidence } from './github-analysis';
const repo = (changes: Partial<RepositoryEvidence> = {}): RepositoryEvidence => ({
  name: 'demo',
  url: 'https://github.com/student/demo',
  description: '',
  language: 'Python',
  skills: ['Python'],
  signals: [],
  files: [],
  inspected: true,
  limitation: '',
  categories: [],
  sampledFiles: [],
  commitCount: 3,
  sampleScope: {
    sourceCandidates: 0,
    documentCandidates: 0,
    sourceSelected: 0,
    documentSelected: 0,
    treeComplete: true,
    workflowRuns: null,
  },
  ...changes,
});
describe('deterministic career planner', () => {
  it('expands every focus into an acyclic prerequisite-first plan without duplicates', () => {
    for (const focus of careerFocuses) {
      const plan = buildCareerPlan(focus.id, []);
      const seen = new Set<string>();
      for (const step of plan.steps) {
        expect(step.requires.every((id) => seen.has(id))).toBeTrue();
        expect(seen.has(step.id)).toBeFalse();
        seen.add(step.id);
      }
      expect(plan.steps.length).toBeGreaterThan(3);
      expect(plan.steps.every((step) => step.roadmap.startsWith('https://roadmap.sh/'))).toBeTrue();
    }
  });
  it('never treats Python metadata as AI or model-training mastery', () => {
    const plan = buildCareerPlan('ai', [repo()]);
    expect(plan.steps.find((step) => step.id === 'llm')?.status).toBe('unknown');
    expect(plan.steps.find((step) => step.id === 'programming')?.status).toBe('observed');
    expect(plan.completed).toBe(0);
  });
  it('uses source import evidence without matching plain mentions or comments', () => {
    const source = {
      path: 'src/main.py',
      url: 'https://github.com/example',
      text: '# import openai\nThis mentions torch\nfrom sklearn.metrics import accuracy_score\nfrom openai import OpenAI',
    };
    expect(detectTechnologyImports([source]).map((item) => item.name)).toEqual([
      'LLM SDK',
      'ML library',
    ]);
    expect(
      detectTechnologyImports([{ ...source, text: 'import OpenAI from "openai";' }])[0].name,
    ).toBe('LLM SDK');
  });
  it('keeps AI applications and ML training paths distinct', () => {
    expect(buildCareerPlan('ai', []).steps.some((step) => step.id === 'ai-eval')).toBeTrue();
    expect(buildCareerPlan('ml', []).steps.some((step) => step.id === 'ml-eval')).toBeTrue();
    expect(buildCareerPlan('ml', []).steps.some((step) => step.id === 'retrieval')).toBeFalse();
  });
  it('rejects out-of-order completion and invalid milestone IDs', () => {
    const plan = buildCareerPlan('software', [], ['systems', 'not-real']);
    expect(plan.completed).toBe(0);
    expect(updateMilestones(plan, 'systems', true)).toEqual([]);
    expect(updateMilestones(plan, 'not-real', true)).toEqual([]);
  });
  it('clears descendants on prerequisite removal while preserving unrelated validation', () => {
    let plan = buildCareerPlan('ai', []);
    const all = plan.steps.map((step) => step.id);
    plan = buildCareerPlan('ai', [], all);
    expect(plan.completed).toBe(all.length);
    const remaining = updateMilestones(plan, 'programming', false);
    expect(remaining).not.toContain('ai-eval');
    expect(remaining).not.toContain('delivery');
    expect(remaining).toContain('git');
  });
  it('is deterministic and repeated technologies do not create extra priority or milestones', () => {
    expect(buildCareerPlan('backend', [repo()]).steps.map((step) => step.id)).toEqual(
      buildCareerPlan('backend', [repo(), repo()]).steps.map((step) => step.id),
    );
    expect(buildCareerPlan('software', [])).toEqual(buildCareerPlan('software', []));
  });
  it('prioritizes observed gaps without hiding positive evidence', () => {
    const item = repo({
      categories: [
        {
          name: 'README',
          checks: [
            {
              label: 'Setup instructions',
              value: 0,
              passed: false,
              weight: 5,
              applicable: true,
              evidence: 'Missing setup',
              action: '',
              url: 'https://github.com/student/demo',
            },
          ],
        },
      ],
    });
    const plan = buildCareerPlan('software', [item]);
    expect(plan.next[0].id).toBe('git');
    expect(plan.next[0].status).toBe('needs-work');
  });
});
