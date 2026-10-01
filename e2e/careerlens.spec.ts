import { expect, test } from '@playwright/test';

test('GitHub evidence, role map, actions and downloadable report', async ({ page }) => {
  await page.route('https://api.github.com/**', async (route) => {
    const url = route.request().url();
    let data: unknown;
    if (url.includes('/git/trees/'))
      data = {
        truncated: false,
        tree: [
          { path: 'README.md', type: 'blob' },
          { path: 'Dockerfile', type: 'blob' },
          { path: 'tsconfig.json', type: 'blob' },
          { path: 'src/api.ts', type: 'blob' },
        ],
      };
    else if (url.includes('/contents/')) {
      const text = url.includes('README')
        ? '# Portfolio API\nThis project helps students organize useful projects and present their work to collaborators. It supports clear examples and a repeatable local development workflow. The repository explains the main features, the intended audience and the design choices that guide the implementation.\n## Installation\nInstall the dependencies and start the local server.\n```sh\nnpm install\n```\n## Usage\nSend a request to the public example endpoint and inspect the response.\n[Demo](https://example.com)'
        : 'export const answer = 42;';
      data = {
        encoding: 'base64',
        content: Buffer.from(text).toString('base64'),
        size: text.length,
      };
    } else if (url.includes('/commits?'))
      data = Array.from({ length: 5 }, (_, i) => ({
        sha: `abc${i}`,
        commit: {
          message: `Implement endpoint validation case ${i}`,
          author: { date: `2026-09-${10 + i}T10:00:00Z` },
        },
      }));
    else if (url.includes('/repos?'))
      data = [
        {
          name: 'portfolio-api',
          description: 'A public API project',
          language: 'TypeScript',
          fork: false,
          archived: false,
          default_branch: 'main',
        },
        { name: 'forked-project', fork: true, archived: false },
        { name: 'archived-project', fork: false, archived: true },
      ];
    else data = { login: 'student', public_repos: 3 };
    await route.fulfill({ json: data });
  });
  await page.goto('/');
  await expect(page).toHaveURL(/\/$/);
  await page.getByLabel('GitHub username or profile URL').fill('https://github.com/student');
  await page.getByRole('button', { name: 'Analyze my GitHub' }).click();
  await expect(page.getByRole('heading', { name: 'student’s career lens' })).toBeVisible();
  await expect(page.getByText('1 repositories selected')).toBeVisible();
  await expect(page.getByTestId('overall-score')).toHaveText('42/100');
  await expect(page.getByText('93% weighted evidence coverage')).toBeVisible();
  await page
    .locator('.category-details')
    .filter({ hasText: 'README content' })
    .locator('summary')
    .click();
  await expect(page.getByText('Explains the project', { exact: true })).toBeVisible();
  await expect(page.getByText('5 / 5 points').first()).toBeVisible();
  await page.screenshot({ path: 'test-results/careerlens-score-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/careerlens-score-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('button', { name: 'Evidence profile', exact: true }).click();
  await expect(page.getByText('Docker · 1 repository')).toBeVisible();
  await page.getByText('Inspect supporting files').click();
  await expect(page.getByRole('link', { name: 'Dockerfile', exact: true })).toHaveAttribute(
    'href',
    'https://github.com/student/portfolio-api/blob/main/Dockerfile',
  );
  await expect(page.getByText('forked-project')).toHaveCount(0);
  await page.getByRole('button', { name: 'Career discovery', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Backend Developer' })).toBeVisible();
  await page.getByRole('button', { name: 'Next 3 moves', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Automated test files' })).toBeVisible();
  await page.getByRole('button', { name: 'Career path', exact: true }).click();
  await page.getByLabel('Focus path', { exact: true }).selectOption('ai');
  await expect(page.locator('.path-summary')).toContainText('AI Engineer');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download report' }).click();
  const reportDownload = await download;
  expect(reportDownload.suggestedFilename()).toBe('careerlens-student.json');
  const stream = await reportDownload.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const exported = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  expect(exported.score.score).toBe(42);
  expect(exported.categoryScores).toHaveLength(5);
  expect(exported.scoringVersion).toBe('2.0');
  expect(exported.careerPlan.focus.id).toBe('ai');
  expect(exported.careerPlan.steps.some((step: { id: string }) => step.id === 'ai-eval')).toBe(
    true,
  );
  expect(exported.careerPlan.completed).toBe(0);
  expect(exported.score.lower).toBe(39);
  expect(exported.score.upper).toBe(46);
  expect(exported.selection).toEqual({ fetched: 3, eligible: 1, selected: 1, limit: 6 });
  await page.screenshot({ path: 'test-results/careerlens-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/careerlens-mobile.png', fullPage: true });
  await page.getByRole('link', { name: 'AI EXPO attendance' }).click();
  await expect(page).toHaveURL(/attendance/);
});

test('unavailable evidence withholds score and stops requests after a rate limit', async ({
  page,
}) => {
  let deniedRequests = 0;
  await page.route('https://api.github.com/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/contents/') || url.includes('/commits?')) {
      deniedRequests++;
      await route.fulfill({ status: 403, json: { message: 'API rate limit' } });
    } else if (url.includes('/git/trees/')) {
      await route.fulfill({
        json: {
          truncated: true,
          tree: [
            { path: 'README.md', type: 'blob' },
            { path: 'eslint.config.js', type: 'blob' },
          ],
        },
      });
    } else if (url.includes('/repos?')) {
      await route.fulfill({
        json: [
          {
            name: 'partial',
            language: 'TypeScript',
            fork: false,
            archived: false,
            default_branch: 'main',
          },
        ],
      });
    } else await route.fulfill({ json: { login: 'student', public_repos: 1 } });
  });
  await page.goto('/');
  await page.getByLabel('GitHub username or profile URL').fill('student');
  await page.getByRole('button', { name: 'Analyze my GitHub' }).click();
  await expect(page.getByText('INSUFFICIENT EVIDENCE', { exact: true })).toBeVisible();
  await expect(page.getByText('6% weighted evidence coverage')).toBeVisible();
  await expect(page.getByTestId('overall-score')).toHaveText('—/100');
  expect(deniedRequests).toBe(1);
  await page
    .locator('.category-details')
    .filter({ hasText: 'README content' })
    .locator('summary')
    .click();
  await expect(
    page
      .locator('.category-details')
      .filter({ hasText: 'README content' })
      .getByText('Unassessed', { exact: true }),
  ).toHaveCount(5);
  await expect(
    page.getByText('GitHub returned a partial file tree.', { exact: false }),
  ).toBeVisible();
});

test('invalid profile, rate limit, and empty account are explicit', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  const input = page.getByLabel('GitHub username or profile URL');
  const submit = page.getByRole('button', { name: 'Analyze my GitHub' });
  await input.fill('https://example.com/student');
  await submit.click();
  await expect(page.getByRole('alert')).toContainText('github.com');
  await page.route('https://api.github.com/**', (route) =>
    route.fulfill({ status: 403, json: { message: 'rate limit' } }),
  );
  await input.fill('student');
  await submit.click();
  await expect(page.getByRole('alert')).toContainText('GitHub rate limit reached');
  await page.clock.fastForward(61000);
  await page.unroute('https://api.github.com/**');
  await page.route('https://api.github.com/**', (route) =>
    route.fulfill({
      json: route.request().url().includes('/repos?') ? [] : { login: 'student', public_repos: 0 },
    }),
  );
  await submit.click();
  await expect(
    page.getByRole('heading', { name: 'No eligible repositories found.' }),
  ).toBeVisible();
});

test('focus paths enforce prerequisites and reset self-validation when focus changes', async ({
  page,
}) => {
  await page.goto('/');
  const focus = page.getByLabel('Focus path', { exact: true });
  await focus.selectOption('ai');
  await expect(
    page.getByRole('link', { name: 'Explore the AI Engineer roadmap on roadmap.sh ↗' }),
  ).toHaveAttribute('href', 'https://roadmap.sh/ai-engineer');
  const programming = page.getByRole('checkbox', {
    name: 'Validate Programming foundations',
    exact: true,
  });
  const git = page.getByRole('checkbox', {
    name: 'Validate Git and reproducible project setup',
    exact: true,
  });
  const llm = page.getByRole('checkbox', {
    name: 'Validate Model APIs and structured responses',
    exact: true,
  });
  const evaluation = page.getByRole('checkbox', {
    name: 'Validate AI evaluation, safety and failure analysis',
    exact: true,
  });
  await expect(llm).toBeDisabled();
  await programming.check();
  await git.check();
  await expect(llm).toBeEnabled();
  await llm.check();
  await expect(evaluation).toBeDisabled();
  await git.uncheck();
  await expect(llm).not.toBeChecked();
  await expect(llm).toBeDisabled();
  await expect(programming).toBeChecked();
  await focus.selectOption('ml');
  await expect(page.getByRole('heading', { name: /Model training and baselines/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Retrieval and grounded answers/ })).toHaveCount(
    0,
  );
  await expect(page.locator('.path-summary')).toContainText('0 /');
  await focus.selectOption('software');
  await expect(page.getByRole('heading', { name: /System design and reliability/ })).toBeVisible();
  await page.screenshot({ path: 'test-results/career-path-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/career-path-mobile.png', fullPage: true });
});

test('a permission-denied file does not block independent GitHub evidence requests', async ({
  page,
}) => {
  let historyRequests = 0;
  await page.route('https://api.github.com/**', (route) => {
    const url = route.request().url();
    if (url.includes('/contents/'))
      return route.fulfill({
        status: 403,
        json: { message: 'Resource not accessible by integration' },
      });
    if (url.includes('/commits?')) {
      historyRequests++;
      return route.fulfill({ json: [] });
    }
    if (url.includes('/git/trees/'))
      return route.fulfill({
        json: { truncated: false, tree: [{ path: 'README.md', type: 'blob' }] },
      });
    if (url.includes('/repos?'))
      return route.fulfill({
        json: [
          {
            name: 'demo',
            fork: false,
            archived: false,
            default_branch: 'main',
            language: 'Python',
          },
        ],
      });
    return route.fulfill({ json: { login: 'student', public_repos: 1 } });
  });
  await page.goto('/');
  await page.getByLabel('GitHub username or profile URL').fill('student');
  await page.getByRole('button', { name: 'Analyze my GitHub', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'student’s career lens' })).toBeVisible();
  expect(historyRequests).toBe(1);
});

test('optional authentication recovers from public limits and repeated analysis reuses cached responses', async ({
  page,
}) => {
  let authenticatedRequests = 0;
  await page.route('https://api.github.com/**', (route) => {
    if (route.request().headers()['authorization'] !== 'Bearer test-public-read-token')
      return route.fulfill({
        status: 403,
        headers: {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
        },
        json: { message: 'API rate limit exceeded' },
      });
    authenticatedRequests++;
    return route.fulfill({
      json: route.request().url().includes('/repos?') ? [] : { login: 'student', public_repos: 0 },
    });
  });
  await page.goto('/');
  await page.getByLabel('GitHub username or profile URL').fill('student');
  const submit = page.getByRole('button', { name: 'Analyze my GitHub', exact: true });
  await submit.click();
  await expect(page.getByRole('alert')).toContainText('Retry after');
  await page
    .getByText('GitHub access options · avoid the shared public request limit', { exact: true })
    .click();
  await page.getByLabel('GitHub token (optional)', { exact: true }).fill('test-public-read-token');
  await submit.click();
  await expect(page.getByRole('heading', { name: 'student’s career lens' })).toBeVisible();
  expect(authenticatedRequests).toBe(2);
  await submit.click();
  await expect(submit).toBeEnabled();
  expect(authenticatedRequests).toBe(2);
  expect(
    await page.evaluate(() =>
      JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }),
    ),
  ).not.toContain('test-public-read-token');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download report', exact: true }).click();
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString('utf8')).not.toContain('test-public-read-token');
  await page.getByRole('button', { name: 'Clear token', exact: true }).click();
  await expect(page.getByLabel('GitHub token (optional)', { exact: true })).toHaveValue('');
});
