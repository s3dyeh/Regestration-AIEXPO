import { expect, test } from '@playwright/test';

test('language changes preserve the exercise, persist, and restore document direction on exit', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const original = await page
    .locator('html')
    .evaluate((el) => ({ lang: el.getAttribute('lang'), dir: el.getAttribute('dir') }));
  await page.getByRole('link', { name: 'Start learning Git', exact: true }).click();
  await expect(page.locator('.workshop')).toHaveAttribute('dir', 'rtl');
  await page.locator('#workshop-language').selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('.workshop')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('h1')).toHaveText('Two edits. One file. What gets lost?');
  await page.getByRole('button', { name: 'Replace with version A ↓', exact: true }).click();
  await page.getByRole('textbox', { name: 'Type a Git command', exact: true }).fill('git init');
  await page.locator('#command-input').press('Enter');
  await page.locator('[data-action="next"]').click();
  await page.locator('#file-content').fill('A draft survives language changes');
  const journal = await page.evaluate(() => localStorage.getItem('careerlens.git-learning.v1'));
  await page.locator('#workshop-language').selectOption('ar');
  await expect(page.locator('h1')).toHaveText('أنشئ أول نقطة آمنة');
  await expect(page.locator('.working small')).toHaveText('ملفات العمل');
  await expect(page.locator('.staged pre')).toHaveText('(لم يُتتبع بعد)');
  await expect(page.locator('#file-content')).toHaveValue('A draft survives language changes');
  await expect(page.locator('#terminal')).toHaveCSS('direction', 'ltr');
  await expect(page.locator('#file-content')).toHaveCSS('direction', 'ltr');
  expect(await page.evaluate(() => localStorage.getItem('careerlens.git-learning.v1'))).toBe(
    journal,
  );
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/git-learning-ar-mobile.png', fullPage: true });
  await page.locator('#workshop-language').selectOption('en');
  await page.getByRole('button', { name: 'Command reference', exact: true }).click();
  await page
    .getByRole('searchbox', { name: 'Search for a command or concept' })
    .fill('unpublished');
  await expect(page.locator('.command-reference section')).toHaveCount(1);
  await expect(page.locator('.command-reference')).toContainText('Correct safely');
  await page.getByRole('button', { name: 'Close ×', exact: true }).click();
  await page.reload();
  await expect(page.locator('#workshop-language')).toHaveValue('en');
  await expect(page.locator('h1')).toHaveText('Create your first safe checkpoint');
  await expect(page.locator('#file-content')).toHaveValue('A draft survives language changes');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/git-learning-en-mobile.png', fullPage: true });
  await page.getByRole('link', { name: 'CareerLens AI' }).click();
  expect(
    await page
      .locator('html')
      .evaluate((el) => ({ lang: el.getAttribute('lang'), dir: el.getAttribute('dir') })),
  ).toEqual(original);
  expect(errors).toEqual([]);
});

test('all English lessons, goals and feedback translate while the full simulation remains solvable', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const missing: string[] = [];
  page.on('console', (message) => {
    if (/Missing translation/.test(message.text())) missing.push(message.text());
  });
  await page.goto('/learn-git');
  await page.locator('#workshop-language').selectOption('en');
  for (let step = 0; step < 30; step++) {
    const next = page.locator('[data-action="next"]');
    for (let action = 0; action < 25 && !(await next.isEnabled()); action++) {
      await page.locator('[data-action="solution"]').click();
    }
    await expect(next).toBeEnabled();
    const text = await page.locator('#git-main').innerText();
    expect(text).not.toMatch(/[\u0600-\u06ff]/);
    expect(text).not.toMatch(
      /\b(?:challenges|recovery_challenges|scene|engine|session|learning_coach)\.[a-zA-Z]+/,
    );
    await next.click();
  }
  await expect(page.locator('h1')).toHaveText('You built this history with your commands.');
  expect(missing).toEqual([]);
});
