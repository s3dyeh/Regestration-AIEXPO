import { expect, test } from '@playwright/test';

test('homepage entry, integrated route, progress resume and command guide', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Start learning Git', exact: true }).click();
  await expect(page).toHaveURL(/learn-git$/);
  const workshop = page;
  await expect(workshop.locator('.wizard')).toHaveAttribute('data-step', 'problem');
  await workshop.getByRole('button', { name: 'مسار التعلّم', exact: true }).click();
  await expect(workshop.locator('.course-map li')).toHaveCount(30);
  await workshop.locator('[data-action="close"]').click();
  await workshop.getByRole('button', { name: 'دليل الأوامر', exact: true }).click();
  await expect(workshop.getByRole('heading', { name: 'دليل الأوامر والمفاهيم' })).toBeVisible();
  await workshop.locator('[data-action="close"]').click();
  await workshop.locator('[data-action="intro:sara"]').click();
  await workshop.getByRole('textbox', { name: 'اكتب أمر Git', exact: true }).fill('git init');
  await workshop.getByRole('textbox', { name: 'اكتب أمر Git', exact: true }).press('Enter');
  await workshop.locator('[data-action="next"]').click();
  await workshop.locator('#file-content').fill('Event: Saved learning progress');
  await workshop.locator('#file-content').press('Control+Enter');
  await expect(workshop.locator('#editor-status')).not.toContainText('مسودة غير محفوظة');
  await page.reload();
  await expect(workshop.locator('.wizard')).toHaveAttribute('data-step', 'first');
  await expect(workshop.locator('#file-content')).toHaveValue('Event: Saved learning progress');
  await page.getByRole('link', { name: 'CareerLens AI' }).click();
  await page.getByRole('link', { name: 'Start learning Git', exact: true }).click();
  await expect(workshop.locator('.wizard')).toHaveAttribute('data-step', 'first');
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('iframe')).toHaveCount(0);
  await page.screenshot({
    path: 'test-results/git-learning-integrated-mobile.png',
    fullPage: true,
  });
});

test('blocked browser storage keeps the workshop usable', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error('Storage disabled');
    };
  });
  await page.goto('/learn-git');
  const workshop = page;
  await expect(workshop.getByText('الحفظ غير متاح', { exact: false })).toBeVisible();
  await workshop.locator('[data-action="solution"]').click();
  await expect(workshop.locator('.lost-change')).toBeVisible();
});

test('learning coach explains without changing state and command reference filters accessibly', async ({
  page,
}) => {
  await page.goto('/learn-git');
  const hint = page.getByRole('button', { name: 'أحتاج تلميحًا', exact: true });
  await hint.click();
  await expect(page.locator('#challenge-hint')).toContainText('git init');
  await expect(page.locator('[data-action="next"]')).toBeDisabled();
  await expect(page.locator('[data-summary="commits"]')).toHaveText('0');
  await page.getByRole('button', { name: 'اذهب إلى الطرفية ↓', exact: true }).click();
  const command = page.getByRole('textbox', { name: 'اكتب أمر Git', exact: true });
  await expect(command).toBeFocused();
  await command.fill('git init');
  await command.press('Enter');
  await page.locator('[data-action="intro:sara"]').click();
  await page.locator('[data-action="next"]').click();
  await expect(page.locator('#challenge-hint')).toHaveCount(0);
  await expect(page.getByRole('progressbar', { name: 'التجارب المكتملة' })).toHaveAttribute(
    'value',
    '1',
  );
  await page.getByRole('button', { name: 'اذهب إلى المحرر ↓', exact: true }).click();
  const editor = page.locator('#file-content');
  await expect(editor).toBeFocused();
  await editor.press('End');
  await editor.pressSequentially(' learner draft');
  await expect(editor).toBeFocused();
  await expect(page.locator('[data-summary="drafts"]')).toHaveText('1');
  await editor.press('Control+Enter');
  await expect(page.locator('[data-summary="drafts"]')).toHaveText('0');
  await command.fill('git add .');
  await command.press('Enter');
  await expect(page.locator('[data-summary="staged"]')).toHaveText('2');
  await expect(page.locator('[data-summary="unstaged"]')).toHaveText('0');
  const guide = page.getByRole('button', { name: 'دليل الأوامر', exact: true });
  await guide.click();
  const search = page.getByRole('searchbox', { name: 'ابحث عن أمر أو مفهوم' });
  await search.fill('STASH');
  await expect(page.locator('.command-reference section')).toHaveCount(1);
  await expect(page.locator('.command-reference')).toContainText('git stash pop');
  await search.fill('no-such-command');
  await expect(page.locator('.reference-empty')).toBeVisible();
  await page.getByRole('button', { name: 'مسح البحث', exact: true }).click();
  await expect(page.locator('.command-reference section')).toHaveCount(6);
  await search.fill('stash');
  await search.press('Escape');
  await expect(page.locator('#detail-dialog')).not.toBeVisible();
  await expect(guide).toBeFocused();
  await guide.click();
  await expect(search).toHaveValue('');
  await page.locator('[data-action="close"]').click();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole('button', { name: 'أحتاج تلميحًا', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/learning-coach-mobile.png', fullPage: true });
});
