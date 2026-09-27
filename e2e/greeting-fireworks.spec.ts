import { expect, test } from '@playwright/test';

test('corner fireworks render, respect motion changes, and leave with the greeting', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Add demo arrivals' }).click();
  const overlay = page.locator('app-welcome-overlay');
  const fireworks = overlay.locator('app-greeting-fireworks');
  await expect(fireworks).toHaveAttribute('aria-hidden', 'true');
  await expect(fireworks.locator('canvas')).toHaveCount(4);
  await expect
    .poll(() =>
      fireworks
        .locator('canvas')
        .first()
        .evaluate((canvas: HTMLCanvasElement) => {
          const pixels = canvas
            .getContext('2d')!
            .getImageData(0, 0, canvas.width, canvas.height).data;
          return pixels.some((value, index) => index % 4 === 3 && value > 0);
        }),
    )
    .toBe(true);
  // Capture the burst after its short launch trail, while the greeting is still present.
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'test-results/greeting-fireworks-desktop.png' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(fireworks.locator('canvas')).toHaveCount(0);
  await expect(overlay.getByRole('heading')).toBeVisible();
  await expect(overlay).toHaveCount(0, { timeout: 7000 });
  expect(errors).toEqual([]);
});

test('reduced-motion mobile greetings do not initialize fireworks', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Add demo arrivals' }).click();
  const overlay = page.locator('app-welcome-overlay');
  await expect(overlay.getByRole('heading')).toBeVisible();
  await expect(overlay.locator('canvas')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(overlay).toHaveCount(0, { timeout: 7000 });
});
