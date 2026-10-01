import { expect, test } from '@playwright/test';

test('quick start produces a themed profile with clickable badges and expandable sections', async ({
  page,
}) => {
  await page.route('https://capsule-render.vercel.app/**', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="240"><rect width="1200" height="240" fill="#101b36"/><text x="80" y="110" fill="#91b8ff" font-size="44">sam-builds</text><text x="80" y="165" fill="#91b8ff" font-size="24">Learning through software projects</text></svg>',
    }),
  );
  await page.route('https://img.shields.io/**', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="28"><rect width="100" height="28" rx="3" fill="#335fcc"/><text x="12" y="19" fill="white" font-size="12">TECHNOLOGY</text></svg>',
    }),
  );
  await page.goto('/readme');
  await expect(page.getByLabel('About you', { exact: true })).not.toBeVisible();
  await page.getByLabel('GitHub username *', { exact: true }).fill('sam-builds');
  await page.getByLabel('Major or career focus').selectOption('ai');
  await page.getByRole('button', { name: /After hours/ }).click();
  await page.getByRole('button', { name: 'Create my profile ↗', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Download README.md', exact: true })).toBeEnabled();
  await expect(page.locator('.profile-banner')).toBeVisible();
  await expect(page.locator('.profile-banner')).toHaveAttribute('src', /color=101b36/);
  await page.getByRole('button', { name: 'Add focus badge pack', exact: true }).click();
  await expect(page.getByLabel('Badge appearance')).toHaveValue('logos');
  await expect(page.locator('.preview img[alt="PyTorch"]')).toHaveAttribute(
    'src',
    /skillicons.dev/,
  );
  await page.getByLabel('Badge appearance').selectOption('labels');
  await page.getByLabel('Badge style', { exact: true }).selectOption('flat-square');
  const pytorch = page
    .locator('.preview a')
    .filter({ has: page.getByRole('img', { name: 'PyTorch', exact: true }) });
  await expect(pytorch).toHaveAttribute('href', 'https://github.com/topics/pytorch');
  await expect(pytorch.locator('img')).toHaveAttribute('src', /335fcc\?style=flat-square/);
  await page.locator('.preview summary').filter({ hasText: 'Currently learning' }).click();
  await expect(page.locator('.preview')).toContainText('Deepening my understanding');
  await page.getByRole('button', { name: 'Markdown', exact: true }).click();
  await expect(page.getByLabel('Generated Markdown')).toHaveValue(/<details>/);
  await expect(page.getByLabel('Generated Markdown')).toHaveValue(/capsule-render/);
  await expect(page.getByLabel('Generated Markdown')).toHaveValue(
    /https:\/\/github.com\/topics\/pytorch/,
  );
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await page.locator('.output').screenshot({ path: 'test-results/readme-quick-preview.png' });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await expect(page.getByLabel('Badge style', { exact: true })).toHaveValue('flat-square');
  await expect(page.getByRole('button', { name: /After hours/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('guided builder keeps layout, hidden sections and backups consistent across reloads', async ({
  page,
}) => {
  await page.goto('/readme');
  await page.locator('.editor > summary').click();
  await page.getByLabel('Display name *', { exact: true }).fill('Sam');
  await page.getByLabel('GitHub username *', { exact: true }).fill('sam');
  await page.getByLabel('Major or career focus').selectOption('ai');
  await page.getByRole('button', { name: 'Start from my focus', exact: true }).click();
  await expect(page.getByLabel('About you', { exact: true })).toHaveValue(/learning by building/);
  await page.getByLabel('README layout').selectOption('portfolio');
  await page.getByRole('button', { name: 'Add project', exact: true }).click();
  await page.getByLabel('Project name', { exact: true }).fill('Search demo');
  await page
    .getByLabel('Project description', { exact: true })
    .fill('A small search tool I built to explore retrieval.');
  await page.getByLabel('Your contribution or outcome').fill('Documented retrieval experiments.');
  await page.getByText('Choose sections to include', { exact: true }).click();
  await page
    .getByRole('group', { name: 'Included sections' })
    .getByRole('button', { name: 'About me', exact: true })
    .click();
  await expect(page.locator('.preview h3')).not.toContainText(['About me']);
  await page.getByRole('button', { name: 'Markdown', exact: true }).click();
  await expect(page.getByLabel('Generated Markdown')).not.toHaveValue(/## About me/);
  await expect(page.getByLabel('Generated Markdown')).toHaveValue(
    /\[Selected projects\]\(#selected-projects\)/,
  );
  await expect(page.getByLabel('Generated Markdown')).toHaveValue(
    /\*\*Outcome:\*\* Documented retrieval experiments/,
  );
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download draft backup', exact: true }).click();
  const backup = await downloadPromise;
  const stream = await backup.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const buffer = Buffer.concat(chunks);
  await page.reload();
  await page.locator('.editor > summary').click();
  await expect(page.getByLabel('README layout')).toHaveValue('portfolio');
  await expect(page.getByLabel('Project name', { exact: true })).toHaveValue('Search demo');
  await page.getByLabel('Display name *', { exact: true }).fill('Changed');
  await page
    .getByLabel('Restore draft backup (replaces current draft)')
    .setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer });
  await expect(page.getByLabel('Display name *', { exact: true })).toHaveValue('Sam');
  await page
    .getByLabel('Restore draft backup (replaces current draft)')
    .setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{bad') });
  await expect(
    page.getByText('Could not restore this file. Your existing draft is unchanged.'),
  ).toBeVisible();
  await expect(page.getByLabel('Display name *', { exact: true })).toHaveValue('Sam');
});

test('AI suggestions require review, preserve newer edits, support undo and handle quota failures', async ({
  page,
}) => {
  const original = 'I build small tools in TypeScript and document what I learn.';
  let sent: Record<string, unknown> = {};
  await page.route('**/api/readme-ai', (route) => {
    sent = route.request().postDataJSON();
    return route.fulfill({
      json: {
        suggestions: [
          {
            field: 'about',
            projectId: null,
            value: 'I build and document small TypeScript tools.',
            reason: 'Shorter and clearer.',
          },
          {
            field: 'headline',
            projectId: null,
            value: 'Learning through TypeScript projects',
            reason: 'Keeps the learning focus.',
          },
        ],
        note: 'Review every claim.',
      },
    });
  });
  await page.goto('/readme');
  await page.locator('.editor > summary').click();
  const button = page.getByRole('button', { name: 'Suggest improvements with AI', exact: true });
  await expect(button).toBeDisabled();
  await page.getByLabel('Display name *', { exact: true }).fill('Private Name');
  await page.getByLabel('Website or portfolio URL').fill('https://example.com/private-path');
  await page.getByLabel('About you', { exact: true }).fill(original);
  await button.click();
  await expect(page.locator('.suggestion')).toHaveCount(2);
  expect(JSON.stringify(sent)).not.toContain('Private Name');
  expect(JSON.stringify(sent)).not.toContain('private-path');
  await expect(page.getByLabel('About you', { exact: true })).toHaveValue(original);
  await page.getByRole('button', { name: 'Apply suggestion', exact: true }).first().click();
  await expect(page.getByLabel('About you', { exact: true })).toHaveValue(
    'I build and document small TypeScript tools.',
  );
  await page.getByRole('button', { name: 'Undo last AI edit', exact: true }).click();
  await expect(page.getByLabel('About you', { exact: true })).toHaveValue(original);
  await page.getByLabel('Headline', { exact: true }).fill('My newer headline');
  await expect(page.getByRole('button', { name: 'Apply suggestion', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await expect(page.locator('.suggestion')).toHaveCount(0);
  await page.route('**/api/readme-ai', (route) =>
    route.fulfill({
      status: 429,
      json: { message: 'OpenAI usage or quota limit reached. Try later; your draft is safe.' },
    }),
  );
  await button.click();
  await expect(
    page.getByText('OpenAI usage or quota limit reached. Try later; your draft is safe.'),
  ).toBeVisible();
  await expect(page.getByLabel('About you', { exact: true })).toHaveValue(original);
  await expect(button).toBeEnabled();
});

test('profile README builder previews safely and exports matching Markdown', async ({ page }) => {
  let apiRequests = 0;
  await page.route('https://api.github.com/**', (route) => {
    apiRequests++;
    return route.abort();
  });
  await page.goto('/');
  await page.getByRole('link', { name: 'Start readme now !', exact: true }).click();
  await expect(page).toHaveURL(/\/readme$/);
  await page.locator('.editor > summary').click();
  await expect(
    page.getByRole('heading', { name: 'Start readme now !', exact: true }),
  ).toBeVisible();
  const downloadButton = page.getByRole('button', { name: 'Download README.md', exact: true });
  await expect(downloadButton).toBeDisabled();
  await page.getByLabel('GitHub username *', { exact: true }).fill('student');
  await page.getByLabel('Display name *', { exact: true }).fill('Ahmad');
  await page.route('https://example.com/banner.png', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="300"><rect width="1200" height="300" fill="#25654e"/><text x="60" y="170" fill="white" font-size="60">Building useful software</text></svg>',
    }),
  );
  await page.route('https://example.com/missing.png', (route) => route.abort());
  await page.getByLabel('Banner image URL', { exact: true }).fill('javascript:alert(1)');
  await expect(downloadButton).toBeDisabled();
  await expect(page.locator('.profile-banner')).toHaveCount(0);
  await page
    .getByLabel('Banner image URL', { exact: true })
    .fill('https://example.com/missing.png');
  await expect(page.locator('.banner-fallback')).toBeVisible();
  await page
    .getByLabel('Banner description (alt text)', { exact: true })
    .fill('Building useful software');
  await page.getByLabel('Banner image URL', { exact: true }).fill('https://example.com/banner.png');
  await expect(page.locator('.profile-banner')).toBeVisible();
  await expect(page.locator('.profile-banner')).toHaveAttribute('alt', 'Building useful software');
  await expect(page.locator('.banner-fallback')).toHaveCount(0);
  await page.route('https://img.shields.io/**', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="90" height="28"><rect width="90" height="28" fill="#25654e"/></svg>',
    }),
  );
  await page.getByLabel('Major or career focus').selectOption('ai');
  await page.getByLabel('Badge appearance').selectOption('labels');
  const suggestions = page.getByRole('group', { name: 'Suggested technology badges' });
  await suggestions.getByRole('button', { name: '+ PyTorch', exact: true }).click();
  await suggestions.getByRole('button', { name: '+ scikit-learn', exact: true }).click();
  await page.getByLabel('Major or career focus').selectOption('frontend');
  await expect(
    page.getByRole('button', { name: 'Remove PyTorch badge', exact: true }),
  ).toBeVisible();
  await expect(suggestions.getByRole('button', { name: '+ Angular', exact: true })).toBeVisible();
  await page.getByLabel('Search all technology badges').fill('pytorch');
  await expect(suggestions.getByRole('button')).toHaveCount(1);
  await expect(suggestions.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.locator('.preview').getByRole('img', { name: 'PyTorch', exact: true }),
  ).toHaveAttribute('src', /img.shields.io/);
  await page.getByLabel('Headline', { exact: true }).fill('Software engineer exploring AI');
  await page
    .getByLabel('About you', { exact: true })
    .fill('I build useful tools. <script>alert(1)</script>');
  await page
    .getByLabel('Tools and technologies', { exact: true })
    .fill('Python, TypeScript, Python');
  await page.getByLabel('Currently learning', { exact: true }).fill('Retrieval and evaluation');
  await page.getByRole('button', { name: 'Add project', exact: true }).click();
  await page.getByLabel('Project name', { exact: true }).fill('My project');
  await page.getByLabel('Project URL', { exact: true }).fill('javascript:alert(1)');
  await expect(downloadButton).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('Check the URL');
  await page.getByLabel('Project URL', { exact: true }).fill('https://github.com/student/demo');
  await page.getByLabel('Project description', { exact: true }).fill('A tested example.');
  await expect(page.getByRole('article', { name: 'Profile README preview' })).toContainText(
    'Retrieval and evaluation',
  );
  await expect(page.locator('.preview script')).toHaveCount(0);
  await page.getByRole('button', { name: 'Markdown', exact: true }).click();
  const markdown = await page.getByLabel('Generated Markdown', { exact: true }).inputValue();
  expect(markdown).toContain("# Hi, I'm Ahmad");
  expect(markdown.startsWith('![Building useful software](<https://example.com/banner.png>)')).toBe(
    true,
  );
  expect(markdown).toContain('&lt;script&gt;');
  expect(markdown).toContain(
    '![PyTorch](https://img.shields.io/badge/PyTorch-25654e?style=for-the-badge&logo=pytorch&logoColor=white)',
  );
  expect(markdown).toContain('scikit--learn-25654e');
  expect(markdown.match(/- Python/g)).toHaveLength(1);
  const download = page.waitForEvent('download');
  await downloadButton.click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('README.md');
  const stream = await file.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString('utf8')).toBe(markdown);
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await page.screenshot({ path: 'test-results/readme-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/readme-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Remove project 1', exact: true }).click();
  await expect(page.locator('.preview')).not.toContainText('My project');
  expect(apiRequests).toBe(0);
  await page.getByRole('button', { name: 'Remove banner', exact: true }).click();
  await expect(page.locator('.profile-banner')).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear badges', exact: true }).click();
  await expect(page.locator('.badge-preview img')).toHaveCount(0);
  await page.getByRole('button', { name: 'Markdown', exact: true }).click();
  await expect(page.getByLabel('Generated Markdown', { exact: true })).not.toHaveValue(
    /Technology badges/,
  );
  await expect(page.getByLabel('Generated Markdown', { exact: true })).not.toHaveValue(
    /banner.png/,
  );
});
