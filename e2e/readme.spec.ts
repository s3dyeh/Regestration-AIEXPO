import { expect, test, type Page } from '@playwright/test';

const generatedDraft = {
  content: {
    headline: 'Building useful learning tools',
    about: 'I explore software engineering through practical Angular projects.',
    currentWork: 'A learning app built with Angular.',
    highlights: '',
    learning: 'Interested in testing and accessibility.',
    collaboration: 'Interested in collaborating on learning tools.',
    skills: ['TypeScript', 'Angular'],
    projects: [{ id: 10, description: 'A learning app with an Angular interface.', outcome: '' }],
  },
  repositories: [{ id: 10, name: 'learning-app', url: 'https://github.com/sam/learning-app' }],
  badges: ['TypeScript', 'Angular'],
  location: 'Amman',
  website: '',
  note: 'Review this AI draft and its inferred tools.',
};

async function identity(page: Page) {
  await page.getByLabel('Display name *', { exact: true }).fill('Sam');
  await page.getByLabel('GitHub username *', { exact: true }).fill('sam');
  await page.getByLabel('Major or career focus').selectOption('software');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
}
const build = (page: Page) =>
  page.getByRole('button', { name: 'Build my README with AI', exact: true }).click();

test('two-step wizard generates, edits and exports a complete profile with logos and LinkedIn', async ({
  page,
}) => {
  let sent: unknown;
  await page.route('**/api/readme-ai', (route) => {
    sent = route.request().postDataJSON();
    return route.fulfill({ json: generatedDraft });
  });
  await page.goto('/readme');
  await expect(page.locator('.wizard input, .wizard select')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  await expect(page.getByText('BUILD A PROFILE WITH PURPOSE')).toHaveCount(0);
  await expect(page.getByText('Pick your badges. Make them yours.')).toHaveCount(0);
  await expect(page.getByText('Make your story clearer')).toHaveCount(0);
  await identity(page);
  await build(page);
  await expect(page.locator('.preview')).toContainText('learning-app');
  await expect(page.locator('.profile-banner')).toHaveJSProperty('naturalWidth', 1200);
  await expect(page.locator('.profile-banner')).toHaveAttribute('src', /^data:image\/svg\+xml/);
  expect(sent).toEqual({
    mode: 'generate',
    name: 'Sam',
    username: 'sam',
    focus: 'Computer science / Software engineering',
    includeProjects: true,
  });
  await expect(page.locator('.preview img[alt="Angular"]')).toHaveAttribute(
    'src',
    /skillicons.dev\/icons\?i=angular/,
  );
  await page.getByRole('button', { name: 'Edit my README', exact: true }).click();
  await page.getByLabel('LinkedIn URL', { exact: true }).fill('https://www.linkedin.com/in/sam');
  await page.getByLabel('About you', { exact: true }).fill('My personal rewrite.');
  await expect(page.locator('.preview')).toContainText('My personal rewrite.');
  await expect(
    page
      .locator('.preview a')
      .filter({ has: page.getByRole('img', { name: 'LinkedIn', exact: true }) }),
  ).toHaveAttribute('href', 'https://www.linkedin.com/in/sam');
  await page.getByRole('button', { name: 'Markdown', exact: true }).click();
  const markdown = page.getByLabel('Generated Markdown');
  await expect(markdown).toHaveValue(/\[!\[LinkedIn\]/);
  await expect(markdown).toHaveValue(/My personal rewrite/);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download README.md', exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('README.md');
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString()).toBe(await markdown.inputValue());
  await page.reload();
  await expect(page.locator('.preview')).toContainText('My personal rewrite.');
  await page.getByRole('button', { name: 'Change answers' }).click();
  await page.getByRole('button', { name: 'Return to my draft' }).click();
  await expect(page.locator('.preview')).toContainText('My personal rewrite.');
});

test('project choice is sent to AI and undo restores the previous draft', async ({ page }) => {
  let includeProjects: unknown;
  await page.route('**/api/readme-ai', (route) => {
    includeProjects = route.request().postDataJSON().includeProjects;
    return route.fulfill({
      json: { ...generatedDraft, content: { ...generatedDraft.content, projects: [] } },
    });
  });
  await page.goto('/readme');
  await identity(page);
  await page.getByRole('button', { name: 'No, just introduce me' }).click();
  await build(page);
  await expect(page.locator('.preview')).toContainText(generatedDraft.content.about);
  expect(includeProjects).toBe(false);
  await expect(page.locator('.preview')).not.toContainText('learning-app');
  await page.getByRole('button', { name: 'Undo generated draft' }).click();
  await expect(
    page.getByRole('heading', { name: 'Do you want to include your projects?' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByLabel('Display name *', { exact: true })).toHaveValue('Sam');
});

test('plain-text server failures preserve answers and never surface JSON parse errors', async ({
  page,
}) => {
  await page.route('**/api/readme-ai', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'text/plain',
      body: 'A server error has occurred\nFUNCTION_INVOCATION_FAILED',
    }),
  );
  await page.goto('/readme');
  await identity(page);
  await build(page);
  await expect(page.locator('app-readme-generator [role="status"]')).toContainText(
    'AI server failed',
  );
  await expect(page.locator('.wizard')).not.toContainText('Unexpected token');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByLabel('GitHub username *', { exact: true })).toHaveValue('sam');
});

test('mobile wizard and generated output fit without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.route('**/api/readme-ai', (route) => route.fulfill({ json: generatedDraft }));
  await page.goto('/readme');
  await identity(page);
  await build(page);
  await expect(page.locator('.preview')).toContainText('learning-app');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.getByRole('button', { name: 'Edit my README', exact: true }).click();
  await page.getByLabel('LinkedIn URL', { exact: true }).fill('javascript:alert(1)');
  await expect(
    page.getByRole('button', { name: 'Download README.md', exact: true }),
  ).toBeDisabled();
  await page.getByLabel('LinkedIn URL', { exact: true }).fill('https://linkedin.com/in/sam');
  await expect(page.getByRole('button', { name: 'Download README.md', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Remove learning-app', exact: true }).click();
  await expect(page.locator('.preview')).not.toContainText('learning-app');
});
