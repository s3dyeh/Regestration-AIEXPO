import { expect, test } from '@playwright/test';
test('profile README builder previews safely and exports matching Markdown', async ({ page }) => {
  let apiRequests = 0;
  await page.route('https://api.github.com/**', (route) => {
    apiRequests++;
    return route.abort();
  });
  await page.goto('/');
  await page.getByRole('link', { name: 'Start readme now !', exact: true }).click();
  await expect(page).toHaveURL(/\/readme$/);
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
    '![PyTorch](https://img.shields.io/badge/PyTorch-25654e?style=for-the-badge)',
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
