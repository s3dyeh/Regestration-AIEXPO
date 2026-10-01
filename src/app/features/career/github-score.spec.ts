import { scoreRepository, summarizeScore } from './github-score';
import type { QualityInput, ScoreCategory } from './github-score';
const readme =
  '# Portfolio API\nThis project helps students organize useful projects and present their work to collaborators. It supports clear examples and a repeatable local development workflow. The repository explains the main features, the intended audience and the design choices that guide the implementation.\n## Installation\nInstall the dependencies and start the local server.\n```sh\nnpm install\n```\n## Usage\nSend a request to the public example endpoint and inspect the response.\n[Demo](https://example.com)';
function fixture(): QualityInput {
  const url = 'https://github.com/student/api';
  return {
    paths: [
      'README.md',
      'docs/architecture.md',
      'eslint.config.js',
      '.prettierrc',
      'src/api.test.ts',
      'src/api.ts',
      '.github/workflows/ci.yml',
      'LICENSE',
      'SECURITY.md',
      '.github/dependabot.yml',
    ],
    completeTree: true,
    url,
    readme: { path: 'README.md', text: readme, url },
    documentation: {
      path: 'docs/architecture.md',
      text: '## Architecture\nSeparate transport from the domain and persistence layer.\n## Testing\nRun npm test to verify all the supported workflows.\n## Configuration\nSet the documented environment variables before starting.\n## Contributing\nCreate a branch and explain the intent of the pull request.',
      url,
    },
    sources: [{ path: 'src/api.ts', text: 'export const answer = 42;\n', url }],
    commits: Array.from({ length: 5 }, (_, i) => ({
      message: `Implement endpoint validation case ${i}`,
      date: `2026-09-${10 + i}`,
      url,
    })),
    workflows: [{ id: 1, workflowId: 1, status: 'completed', conclusion: 'success', url }],
  };
}
const find = (input: QualityInput, label: string) =>
  scoreRepository(input)
    .flatMap((category) => category.checks)
    .find((check) => check.label === label)!;
describe('repository evidence rubric v2', () => {
  it('has explicit category weights totaling 100 and a reproducible full-evidence score', () => {
    const categories = scoreRepository(fixture());
    expect(
      categories.map((category) => category.checks.reduce((sum, check) => sum + check.weight, 0)),
    ).toEqual([20, 15, 20, 20, 25]);
    expect(summarizeScore(categories)).toEqual({
      score: 100,
      coverage: 100,
      earned: 100,
      assessed: 100,
      possible: 100,
      lower: 100,
      upper: 100,
    });
  });
  it('withholds a headline score for sparse evidence rather than awarding 100', () => {
    const input = fixture();
    input.completeTree = false;
    input.paths = ['eslint.config.js'];
    input.readme = null;
    input.documentation = null;
    input.sources = [];
    input.commits = null;
    input.workflows = null;
    const summary = summarizeScore(scoreRepository(input));
    expect(summary.score).toBeNull();
    expect(summary.coverage).toBe(6);
    expect(summary.lower).toBe(6);
    expect(summary.upper).toBe(100);
  });
  it('marks unavailable content unknown and reports bounds, not lost points', () => {
    const input = fixture();
    input.readme!.text = null;
    const summary = summarizeScore(scoreRepository(input));
    expect(summary.score).toBe(100);
    expect(summary.coverage).toBe(80);
    expect(summary.lower).toBe(80);
    expect(summary.upper).toBe(100);
  });
  it('does not award points for commit volume or calendar activity', () => {
    const input = fixture();
    const before = summarizeScore([scoreRepository(input)[1]]);
    input.commits = Array.from({ length: 30 }, () => ({
      message: 'Implement validation of incoming requests',
      date: '2020-01-01',
      url: input.url,
    }));
    expect(summarizeScore([scoreRepository(input)[1]])).toEqual(before);
  });
  it('requires enough non-merge evidence without penalizing small or squash histories', () => {
    const input = fixture();
    input.commits = input.commits!.slice(0, 2);
    expect(scoreRepository(input)[1].checks.every((check) => check.value === null)).toBeTrue();
    input.commits = fixture().commits!.map((item) => ({ ...item, merge: true }));
    expect(scoreRepository(input)[1].checks.every((check) => check.value === null)).toBeTrue();
  });
  it('gives proportional message credit instead of a binary 80 percent cliff', () => {
    const input = fixture();
    input.commits![0].message = 'update';
    expect(find(input, 'Specific commit subjects').value).toBe(0.8);
    expect(summarizeScore(scoreRepository(input)).score).toBe(98);
  });
  it('supports Arabic headings and setext Markdown without English word requirements', () => {
    const input = fixture();
    input.readme!.text =
      '# مشروع\nشرح للمشروع ووظيفته.\nالتثبيت\n--------\nثبت الحزم ثم شغل التطبيق باستعمال الأمر التالي.\n```sh\nnpm install\n```\n## الاستخدام\nهذا مثال يوضح كيفية استعمال التطبيق والنتيجة المتوقعة.';
    input.commits = Array.from({ length: 3 }, () => ({
      message: 'إضافة التحقق من بيانات المستخدم',
      date: '',
      url: input.url,
    }));
    expect(find(input, 'Setup instructions').value).toBe(1);
    expect(find(input, 'Usage guidance').value).toBe(1);
    expect(find(input, 'Specific commit subjects').value).toBe(1);
  });
  it('does not borrow another section content or fenced fake headings', () => {
    const input = fixture();
    input.readme!.text =
      '# Project\n## Installation\n## Usage\nLong enough usage explanation and code.\n```sh\nnpm install\n## Architecture\npretend this is real documentation text\n```';
    input.documentation = null;
    input.paths = ['README.md'];
    expect(find(input, 'Setup instructions').value).toBe(0);
    expect(find(input, 'Architecture').value).toBe(0);
  });
  it('does not infer missing documentation from an incomplete content sample', () => {
    const input = fixture();
    input.documentation!.text = '# Other\nOther information';
    input.paths.push('docs/testing.md');
    expect(find(input, 'Testing instructions').value).toBeNull();
  });
  it('uses newest run per workflow, not repeated historical successes', () => {
    const input = fixture();
    input.workflows = [
      { id: 3, workflowId: 1, status: 'completed', conclusion: 'failure', url: input.url },
      ...input.workflows!,
    ];
    expect(find(input, 'Observed workflow outcomes').value).toBe(0);
    input.workflows![0].status = 'in_progress';
    input.workflows![0].conclusion = null;
    expect(find(input, 'Observed workflow outcomes').value).toBeNull();
  });
  it('does not treat workflow configuration as a successful run', () => {
    const input = fixture();
    input.workflows = null;
    expect(find(input, 'CI configuration').value).toBe(1);
    expect(find(input, 'Observed workflow outcomes').value).toBeNull();
  });
  it('keeps unsupported or unreadable source unknown and recognizes Go tests', () => {
    const input = fixture();
    input.sources[0].text = null;
    input.paths = ['main_test.go'];
    expect(find(input, 'Sampled line readability').value).toBeNull();
    expect(find(input, 'Automated test files').value).toBe(1);
  });
  it('does not penalize explicitly inapplicable checks in aggregate', () => {
    const categories: ScoreCategory[] = scoreRepository(fixture());
    categories[0].checks[0].applicable = false;
    categories[0].checks[0].value = 0;
    expect(summarizeScore(categories).possible).toBe(95);
    expect(summarizeScore(categories).score).toBe(100);
  });
});
