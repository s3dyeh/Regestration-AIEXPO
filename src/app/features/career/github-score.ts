export const SCORING_VERSION = '2.0';
export const MIN_SCORE_COVERAGE = 60;
export interface ScoreCheck {
  label: string;
  passed: boolean | null;
  value: number | null;
  weight: number;
  applicable: boolean;
  evidence: string;
  action: string;
  url: string;
}
export interface ScoreCategory {
  name: string;
  checks: ScoreCheck[];
}
export interface ContentSample {
  path: string;
  text: string | null;
  url: string;
}
export interface CommitSample {
  message: string;
  date: string;
  url: string;
  merge?: boolean;
}
export interface WorkflowSample {
  id: number;
  workflowId: number;
  status: string;
  conclusion: string | null;
  url: string;
}
export interface QualityInput {
  paths: string[];
  completeTree: boolean;
  readme: ContentSample | null;
  documentation: ContentSample | null;
  documents?: ContentSample[];
  sources: ContentSample[];
  commits: CommitSample[] | null;
  workflows?: WorkflowSample[] | null;
  url: string;
}
export interface ScoreSummary {
  score: number | null;
  coverage: number;
  earned: number;
  assessed: number;
  possible: number;
  lower: number;
  upper: number;
}
const rounded = (n: number) => Math.round(n * 10) / 10;
export function summarizeScore(categories: ScoreCategory[]): ScoreSummary {
  const checks = categories
    .flatMap((category) => category.checks)
    .filter((check) => check.applicable);
  const possible = checks.reduce((sum, check) => sum + check.weight, 0);
  const assessed = checks.reduce(
    (sum, check) => sum + (check.value === null ? 0 : check.weight),
    0,
  );
  const earned = checks.reduce((sum, check) => sum + check.weight * (check.value ?? 0), 0);
  const coverage = possible ? (assessed / possible) * 100 : 0;
  return {
    score:
      assessed && coverage >= MIN_SCORE_COVERAGE ? Math.round((earned / assessed) * 100) : null,
    coverage: Math.round(coverage),
    earned: rounded(earned),
    assessed,
    possible,
    lower: possible ? rounded((earned / possible) * 100) : 0,
    upper: possible ? rounded(((earned + possible - assessed) / possible) * 100) : 100,
  };
}

// Strip code/comments before evaluating prose so examples cannot impersonate documentation.
export function prose(text: string): string {
  return text.replace(/<!--[^]*?-->/g, '').replace(/^(`{3,}|~{3,})[^\n]*\n[^]*?^\1[^\n]*$/gm, '');
}
const normalize = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
function sections(text: string): { title: string; body: string }[] {
  const lines = text.replace(/<!--[^]*?-->/g, '').split('\n');
  const result: { title: string; body: string }[] = [];
  let current: { title: string; body: string } | undefined;
  let fence = '';
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = '';
      if (current) current.body += line + '\n';
      continue;
    }
    const atx = !fence ? line.match(/^#{1,6}\s+(.+)$/) : null;
    const setext = !fence && line.trim() && /^\s{0,3}(=+|-+)\s*$/.test(lines[index + 1] ?? '');
    if (atx || setext) {
      current = { title: normalize(atx ? atx[1] : line), body: '' };
      result.push(current);
      if (setext) index++;
    } else if (current) current.body += line + '\n';
  }
  return result;
}
function section(text: string, words: string): boolean {
  const pattern = new RegExp(words, 'iu');
  return sections(text).some(
    (part) => pattern.test(part.title) && part.body.replace(/\s/g, '').length >= 20,
  );
}
const ratio = <T>(items: T[], predicate: (item: T) => boolean): number =>
  items.filter(predicate).length / items.length;
export function scoreRepository(input: QualityInput): ScoreCategory[] {
  const { paths, completeTree, url } = input;
  const check = (
    label: string,
    weight: number,
    result: number | boolean | null,
    evidence: string,
    action: string,
    source = url,
    applicable = true,
  ): ScoreCheck => {
    const value =
      result === null
        ? null
        : typeof result === 'boolean'
          ? Number(result)
          : Math.max(0, Math.min(1, result));
    return {
      label,
      weight,
      value,
      passed: value === null ? null : value === 1,
      applicable,
      evidence,
      action,
      url: source,
    };
  };
  const has = (pattern: RegExp) =>
    paths.some((path) => pattern.test(path)) ? true : completeTree ? false : null;
  const pathCheck = (label: string, weight: number, pattern: RegExp, action: string) => {
    const matches = paths.filter((path) => pattern.test(path));
    return check(
      label,
      weight,
      has(pattern),
      matches.length
        ? `File evidence: ${matches.join(', ')}. Presence only; contents and execution are not verified.`
        : completeTree
          ? 'No recognized file in the complete filtered tree. Other conventions may be missed.'
          : 'Incomplete file tree; absence cannot be confirmed.',
      action,
      matches[0] ? `${url}/search?q=${encodeURIComponent(matches[0])}&type=code` : url,
    );
  };
  const readme = input.readme?.text ?? (completeTree && !input.readme ? '' : null);
  const docs = input.documents ?? (input.documentation ? [input.documentation] : []);
  const materials = [input.readme, ...docs].filter((sample): sample is ContentSample => !!sample);
  const docPaths = paths.filter((path) =>
    /(^docs?\/.*\.(md|rst|txt)$|(^|\/)(CONTRIBUTING|ARCHITECTURE|DEVELOPMENT|TESTING)\.md$)/i.test(
      path,
    ),
  );
  const docsComplete =
    completeTree &&
    materials.every((sample) => sample.text !== null) &&
    docPaths.every((path) => docs.some((sample) => sample.path === path));
  const readmeCheck = (
    label: string,
    weight: number,
    predicate: (text: string) => boolean,
    rule: string,
    action: string,
  ) =>
    check(
      label,
      weight,
      readme === null ? null : predicate(readme),
      readme === null ? 'README content unavailable.' : rule,
      action,
      input.readme?.url ?? url,
    );
  const docCheck = (label: string, words: string, action: string) => {
    const matched = materials.find((sample) => sample.text !== null && section(sample.text, words));
    return check(
      label,
      5,
      matched ? true : docsComplete ? false : null,
      matched
        ? `Relevant heading with at least 20 non-whitespace characters in its own section: ${matched.path}. Content correctness is not verified.`
        : docsComplete
          ? 'No recognized substantive section in the inspected README/documentation.'
          : 'No match in the sample; other or unavailable documentation may contain evidence.',
      action,
      matched?.url ?? url,
    );
  };
  const commits =
    input.commits?.filter(
      (item) => !item.merge && !/^Merge (pull request|branch|remote-tracking)/i.test(item.message),
    ) ?? null;
  const subjects = commits?.map((item) => item.message.split('\n')[0].trim()) ?? [];
  const commitCheck = (
    label: string,
    weight: number,
    predicate: (message: string) => boolean,
    rule: string,
    action: string,
  ) =>
    check(
      label,
      weight,
      subjects.length >= 3 ? ratio(subjects, predicate) : null,
      `${subjects.length} non-merge authored commits sampled. ${subjects.length < 3 ? 'At least 3 are required to assess message patterns; missing history is not a failure.' : `${subjects.filter(predicate).length}/${subjects.length} match. ${rule}`} No points for commit count or frequency.`,
      action,
      commits?.[0]?.url ?? `${url}/commits`,
    );
  const available = input.sources.filter((sample) => sample.text !== null);
  const allSources = available.length > 0 && available.length === input.sources.length;
  const sourceText = available.map((sample) => ({
    ...sample,
    lines: sample.text!.split('\n').filter((line) => line.trim()),
  }));
  const sourceDescription = `${available.length}/${input.sources.length} selected source files read (${available.map((sample) => sample.path).join(', ') || 'none'}). Style proxies only; not a clean-code or correctness assessment.`;
  const latest = new Map<number, WorkflowSample>();
  for (const run of input.workflows ?? [])
    if (!latest.has(run.workflowId)) latest.set(run.workflowId, run);
  const runs = [...latest.values()];
  const completed = runs.filter(
    (run) =>
      run.status === 'completed' &&
      run.conclusion !== 'skipped' &&
      run.conclusion !== 'neutral' &&
      run.conclusion !== 'cancelled',
  );
  return [
    {
      name: 'README content',
      checks: [
        readmeCheck(
          'Explains the project',
          5,
          (text) => prose(text).split(/\s+/).filter(Boolean).length >= 40,
          'At least 40 prose words outside code fences and HTML comments; a heuristic, not semantic validation.',
          'Explain the purpose, audience and main features.',
        ),
        readmeCheck(
          'Setup instructions',
          5,
          (text) =>
            sections(text).some(
              (part) =>
                /install|setup|getting started|quick start|تثبيت|اعداد|بدء|تشغيل/.test(
                  part.title,
                ) &&
                part.body.replace(/\s/g, '').length >= 20 &&
                /```|~~~|`[^`]+`/.test(part.body),
            ),
          'Setup heading with a substantive body and code example in that same section (English/Arabic patterns).',
          'Add reproducible setup instructions and commands in the setup section.',
        ),
        readmeCheck(
          'Usage guidance',
          5,
          (text) => section(text, 'usage|how to use|example|استخدام|مثال|امثلة'),
          'Usage/example section with substantive content (English/Arabic patterns).',
          'Show example inputs and expected results.',
        ),
        readmeCheck(
          'Navigable structure',
          2,
          (text) => sections(text).filter((part) => part.body.length >= 20).length >= 3,
          'At least three headings with substantive section bodies; headings in fenced code are ignored.',
          'Organize the README into meaningful sections.',
        ),
        readmeCheck(
          'Supporting references',
          3,
          (text) => /\[[^\]]+\]\((?:https?:\/\/|\.?\.?\/)[^)]+\)/.test(prose(text)),
          'A Markdown link to a web or relative resource; target availability is not verified.',
          'Link to examples, a demo or supporting documentation.',
        ),
      ],
    },
    {
      name: 'Commit history',
      checks: [
        commitCheck(
          'Specific commit subjects',
          10,
          (message) =>
            [...message].length >= 8 &&
            !/^(initial commit|update|fix|wip|changes?|test|تحديث|تعديل|اصلاح|\.+)(\s+files?)?[.!]*$/iu.test(
              normalize(message),
            ),
          'Subjects have at least 8 Unicode characters and avoid known generic messages; all scripts supported, generic-word list is English/Arabic.',
          'Describe the actual change instead of generic messages; do not create extra commits for points.',
        ),
        commitCheck(
          'Concise commit subjects',
          5,
          (message) => [...message].length <= 100 && message.length > 0,
          'Subjects are at most 100 Unicode characters. No English word-count requirement.',
          'Keep the subject concise and put detailed context in the body.',
        ),
      ],
    },
    {
      name: 'Code-maintenance practices',
      checks: [
        pathCheck(
          'Lint configuration',
          6,
          /(^|\/)(eslint\.config\.[cm]?[jt]s|\.eslintrc[^/]*|ruff\.toml|\.ruff\.toml|\.pylintrc|\.golangci\.ya?ml|checkstyle\.xml|\.rubocop\.yml|clippy\.toml)$/i,
          'Configure and run a linter appropriate to the language.',
        ),
        pathCheck(
          'Formatting configuration',
          2,
          /(^|\/)(\.prettierrc[^/]*|prettier\.config\.[cm]?[jt]s|\.editorconfig|rustfmt\.toml|\.clang-format|\.scalafmt\.conf)$/i,
          'Define consistent formatting for contributors.',
        ),
        pathCheck(
          'Automated test files',
          8,
          /(^|\/)(__tests__|tests?|spec)\/|\.(spec|test)\.[cm]?[jt]sx?$|(^|\/)test_[^/]+\.py$|_test\.go$|Test\.java$|Tests?\.cs$|_spec\.rb$/i,
          'Add tests for meaningful behavior and failure cases; presence does not prove coverage.',
        ),
        check(
          'Sampled line readability',
          2,
          allSources && sourceText.every((sample) => sample.lines.length)
            ? sourceText.reduce(
                (sum, sample) => sum + ratio(sample.lines, (line) => [...line].length <= 120),
                0,
              ) / sourceText.length
            : null,
          `Fraction of nonblank lines at most 120 characters, averaged equally per sampled file. ${sourceDescription}`,
          'Review long lines where wrapping would improve readability.',
          available[0]?.url,
        ),
        check(
          'Sampled file focus',
          2,
          allSources ? ratio(available, (sample) => sample.text!.split('\n').length <= 300) : null,
          `Fraction of sampled files at most 300 lines. ${sourceDescription}`,
          'Review large files for separable responsibilities; file length alone does not prove poor design.',
          available[0]?.url,
        ),
      ],
    },
    {
      name: 'Documentation',
      checks: [
        docCheck(
          'Architecture',
          'architecture|design|structure|معماري|تصميم|هيكل',
          'Document architecture and design tradeoffs.',
        ),
        docCheck(
          'Testing instructions',
          'test|verification|اختبار|تحقق',
          'Document how to run tests and their scope.',
        ),
        docCheck(
          'Configuration',
          'config|environment|deployment|اعداد|بيئة|نشر',
          'Explain configuration, environment variables and deployment.',
        ),
        docCheck(
          'Contribution guidance',
          'contribut|development|maintain|مساهم|تطوير|صيانة',
          'Explain the development and contribution workflow.',
        ),
      ],
    },
    {
      name: 'Automation & stewardship',
      checks: [
        pathCheck(
          'CI configuration',
          6,
          /(^|\/)(\.github\/workflows\/[^/]+\.ya?ml|\.gitlab-ci\.yml|\.travis\.yml|Jenkinsfile|azure-pipelines\.yml|\.circleci\/config\.yml)$/i,
          'Configure continuous integration for builds and checks.',
        ),
        check(
          'Observed workflow outcomes',
          7,
          completed.length && completed.length === runs.length
            ? ratio(completed, (run) => run.conclusion === 'success')
            : null,
          `${completed.length} assessable latest GitHub Actions runs across ${runs.length} workflows in a sample of up to 10 default-branch runs. Pending/skipped/cancelled/neutral outcomes are unknown. Success does not prove tests ran, and external CI is not inspected.`,
          'Inspect failed workflow runs and verify that relevant checks are executed.',
          completed[0]?.url ?? `${url}/actions`,
        ),
        pathCheck(
          'License file',
          4,
          /^(LICENSE|LICENCE|COPYING)(\.[^/]+)?$/i,
          'Publish an appropriate license; file presence does not verify license terms.',
        ),
        pathCheck(
          'Security reporting policy',
          4,
          /^(\.github\/|docs\/)?SECURITY\.md$/i,
          'Document how to report vulnerabilities privately.',
        ),
        pathCheck(
          'Dependency update configuration',
          4,
          /(^|\/)(\.github\/dependabot\.ya?ml|renovate\.json5?|\.renovaterc(\.json)?|\.github\/renovate\.json5?)$/i,
          'Configure dependency update automation; configuration does not prove updates are applied.',
        ),
      ],
    },
  ];
}
