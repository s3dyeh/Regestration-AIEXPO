import { expect, test } from '@playwright/test';
import { fillParticipant, registerParticipant } from './participant-form';

test('register, check-in, repeat welcome, unknown ID, and preserved attendance', async ({
  page,
  context,
}) => {
  await page.goto('/admin');
  await registerParticipant(page);
  await expect(page.getByText('No attendance recorded yet.')).toBeVisible();
  await expect(page.locator('app-event-registration')).toHaveCount(0);
  const dashboard = await context.newPage();
  await dashboard.goto('/dashboard');
  await expect(dashboard.getByTestId('registration-total')).toHaveText('0');
  await page.goto('/register');
  await expect(page).toHaveURL(/attendance/);
  await expect(page.getByRole('button', { name: 'Open QR camera' })).toHaveCount(0);
  await expect(page.locator('video')).toHaveCount(0);
  await page.getByLabel('Participant ID', { exact: true }).fill('001');
  await page.getByLabel('Participant ID', { exact: true }).press('Enter');
  await expect(page.getByRole('status')).toContainText('attendance is confirmed');
  await expect(dashboard.getByTestId('registration-total')).toHaveText('1');
  await expect(dashboard.locator('app-welcome-overlay')).toContainText('أحمد سعدية');
  await page.locator('body').dispatchEvent('keydown', { key: 'r', ctrlKey: true });
  await expect(page.getByRole('status')).toContainText('attendance is confirmed');
  await page.keyboard.press('r');
  await expect(page.getByLabel('Participant ID', { exact: true })).toBeFocused();
  await expect(page.getByLabel('Participant ID', { exact: true })).toHaveValue('');
  await page.keyboard.type('r');
  await expect(page.getByLabel('Participant ID', { exact: true })).toHaveValue('r');
  await page.getByLabel('Participant ID', { exact: true }).fill('001');
  await page.getByRole('button', { name: 'Confirm attendance' }).click();
  await expect(page.getByRole('status')).toContainText('already been marked as attended');
  await expect(page.getByRole('status')).toContainText('Welcome back');
  await expect(dashboard.getByTestId('registration-total')).toHaveText('1');
  await page.keyboard.press('Shift+R');
  await expect(page.getByLabel('Participant ID', { exact: true })).toBeFocused();
  await page.getByLabel('Participant ID', { exact: true }).fill('missing');
  await page.getByRole('button', { name: 'Confirm attendance' }).click();
  await expect(page.getByRole('alert')).toContainText('ID not found');
  await page.goto('/admin');
  await fillParticipant(page, { name: 'Overwrite Attempt' });
  await page.getByRole('button', { name: 'Register participant', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('ID already exists');
  await expect(page.locator('tbody')).toContainText('أحمد سعدية');
  await expect(page.locator('tbody')).not.toContainText('Not attended');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/attendance-admin-mobile.png', fullPage: true });
  await page.goto('/attendance');
  await page.screenshot({ path: 'test-results/attendance-mobile.png', fullPage: true });
});
test('simultaneous check-ins count a participant once', async ({ page, context }) => {
  await page.goto('/admin');
  await registerParticipant(page);
  const second = await context.newPage();
  await Promise.all([page.goto('/attendance'), second.goto('/attendance')]);
  for (const tab of [page, second])
    await tab.getByLabel('Participant ID', { exact: true }).fill('001');
  await Promise.all([
    page.getByRole('button', { name: 'Confirm attendance' }).click(),
    second.getByRole('button', { name: 'Confirm attendance' }).click(),
  ]);
  await expect(page.getByRole('status')).toBeVisible();
  await expect(second.getByRole('status')).toBeVisible();
  const results = [
    await page.getByRole('status').textContent(),
    await second.getByRole('status').textContent(),
  ];
  expect(results.filter((text) => text?.includes('already been marked'))).toHaveLength(1);
  await page.goto('/dashboard');
  await expect(page.getByTestId('registration-total')).toHaveText('1');
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
