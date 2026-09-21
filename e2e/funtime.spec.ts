import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function fillRegistration(page: Page, email: string, name = 'Lina Omar') {
  await page.getByLabel('Full name').fill(name);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Phone number').fill('+962791234567');
  await page.getByRole('combobox', { name: 'Major', exact: true }).click();
  await page.getByRole('option', { name: 'Computer Science', exact: true }).click();
  await page.getByRole('combobox', { name: 'Gender', exact: true }).click();
  await page.getByRole('option', { name: 'Female', exact: true }).click();
}

test('registration reaches another tab, animates once, blocks duplicates and survives reload', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const dashboard = await context.newPage();
  dashboard.on('pageerror', (error) => errors.push(error.message));
  await dashboard.goto('/dashboard');
  await expect(dashboard.getByTestId('registration-total')).toHaveText('0');
  await page.goto('/register');
  await fillRegistration(page, 'LINA@example.com');
  await page.getByRole('button', { name: 'I’m in. Let’s do this.' }).click();
  await expect(page.getByRole('heading', { name: /See you there/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: /See you there/ })).toBeVisible();
  await expect(dashboard.locator('app-welcome-overlay')).toContainText('Lina Omar.');
  await expect(dashboard.getByTestId('registration-total')).toHaveText('1');
  await expect(dashboard.locator('app-welcome-overlay')).toHaveCount(0, { timeout: 7000 });
  await page.getByRole('button', { name: 'Register another participant' }).click();
  await fillRegistration(page, 'lina@example.com');
  await page.getByRole('button', { name: 'I’m in. Let’s do this.' }).click();
  await expect(page.getByRole('alert')).toContainText('already registered');
  await expect(dashboard.getByTestId('registration-total')).toHaveText('1');
  await dashboard.reload();
  await expect(dashboard.getByTestId('registration-total')).toHaveText('1');
  await expect(dashboard.locator('app-welcome-overlay')).toHaveCount(0);
  await expect(dashboard.getByRole('button', { name: /Registration desk/ })).toHaveCount(0);
  await expect(dashboard.locator('table')).toHaveCount(0);
  await expect(dashboard.getByText('lina@example.com')).toHaveCount(0);
  expect(errors).toEqual([]);
  await dashboard.screenshot({ path: 'test-results/funtime-dashboard.png', fullPage: true });
});

test('validates fields, greets by full name, and fits mobile', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/register');
  await page.getByRole('button', { name: 'I’m in. Let’s do this.' }).click();
  await expect(page.getByText('Enter your full name.')).toBeVisible();
  await fillRegistration(page, 'private@example.com', 'أحمد سعدية');
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  const dashboard = await context.newPage();
  await dashboard.goto('/dashboard');
  await expect(dashboard.getByTestId('registration-total')).toHaveText('0');
  await page.getByRole('button', { name: 'I’m in. Let’s do this.' }).click();
  await expect(dashboard.locator('app-welcome-overlay')).toContainText('أحمد سعدية.');
  await expect(page.getByRole('heading', { name: /See you there/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Register another participant' }).click();
  await page.screenshot({ path: 'test-results/funtime-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await dashboard.setViewportSize({ width: 390, height: 844 });
  await expect(dashboard.locator('app-welcome-overlay')).toHaveCount(0, { timeout: 7000 });
  expect(await dashboard.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
    true,
  );
});

test('simultaneous email submissions create one record and a burst is batched', async ({
  page,
  context,
}) => {
  const second = await context.newPage();
  const dashboard = await context.newPage();
  await dashboard.goto('/dashboard');
  await expect(dashboard.getByTestId('registration-total')).toHaveText('0');
  await Promise.all([page.goto('/register'), second.goto('/register')]);
  await Promise.all([
    fillRegistration(page, 'same@example.com'),
    fillRegistration(second, 'SAME@example.com'),
  ]);
  await Promise.all([
    page.getByRole('button', { name: 'I’m in. Let’s do this.' }).click(),
    second.getByRole('button', { name: 'I’m in. Let’s do this.' }).click(),
  ]);
  await expect(dashboard.getByTestId('registration-total')).toHaveText('1');
  await expect
    .poll(
      async () =>
        (await page.getByRole('alert').count()) + (await second.getByRole('alert').count()),
    )
    .toBe(1);
  await expect(dashboard.locator('app-welcome-overlay')).toHaveCount(0, { timeout: 7000 });
  await dashboard.getByRole('button', { name: 'Add demo arrivals' }).click();
  await expect(dashboard.getByTestId('registration-total')).toHaveText('13');
  await expect(dashboard.locator('app-welcome-overlay')).toContainText('12 new faces.', {
    timeout: 10_000,
  });
});

test('dashboard and partner logos fit a 16:9 stage', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/dashboard');
  await expect(page.getByTestId('registration-total')).toHaveText('0');
  await page.getByRole('button', { name: 'Realsoft — dashboard actions' }).click();
  await page.getByRole('menuitem', { name: 'Pause welcomes' }).click();
  await page.getByRole('button', { name: 'Realsoft — dashboard actions' }).click();
  await expect(page.getByRole('menuitem', { name: 'Resume welcomes' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Add demo arrivals' }).click();
  await expect(page.getByTestId('registration-total')).toHaveText('12');
  await expect(page.getByText('Be part of what’s next.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Copy registration link' })).toHaveCount(0);
  await expect(page.locator('.event-logo')).toHaveAttribute('src', '/assets/img/event-logo.webp');
  for (const [width, height] of [
    [1920, 1080],
    [1280, 720],
    [2560, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    await expect
      .poll(() =>
        page.locator('.dashboard-mode').evaluate((el) => {
          const frame = el.getBoundingClientRect();
          const partners = el.querySelector('.partners')!.getBoundingClientRect();
          return (
            Math.abs(frame.width / frame.height - 16 / 9) < 0.01 &&
            partners.bottom <= frame.bottom + 1 &&
            document.documentElement.scrollHeight <= innerHeight + 1 &&
            document.documentElement.scrollWidth <= innerWidth + 1
          );
        }),
      )
      .toBe(true);
    for (const chart of await page.locator('.chart-panel app-event-chart').all()) {
      const bounds = await chart.boundingBox();
      expect(bounds?.height).toBeGreaterThan(60);
    }
    await page.screenshot({ path: `test-results/expo-stage-${width}.png` });
  }
});
