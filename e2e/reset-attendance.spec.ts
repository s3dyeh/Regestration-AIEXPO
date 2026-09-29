import { expect, test } from '@playwright/test';

test('attendance reset requires confirmation, refreshes the dashboard and preserves participants', async ({
  page,
  context,
}) => {
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Realsoft — dashboard actions' }).click();
  await page.getByRole('menuitem', { name: 'Pause welcomes' }).click();
  await page.getByRole('button', { name: 'Add demo arrivals' }).click();
  await expect(page.getByTestId('registration-total')).toHaveText('12');
  const admin = await context.newPage();
  await admin.goto('/admin');
  await expect(admin.locator('tbody tr')).toHaveCount(10);
  const id = (await admin.locator('tbody tr').first().locator('td').first().textContent())!.trim();
  admin.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toContain('Participant registrations will be kept');
    await dialog.dismiss();
  });
  await admin.getByRole('button', { name: 'Reset attendance', exact: true }).click();
  await expect(admin.locator('.count')).toHaveText('12');
  await expect(page.getByTestId('registration-total')).toHaveText('12');
  admin.once('dialog', (dialog) => dialog.accept());
  await admin.getByRole('button', { name: 'Reset attendance', exact: true }).click();
  await expect(admin.getByRole('status').filter({ hasText: '12 check-ins cleared' })).toBeVisible();
  await expect(admin.getByText('No attendance recorded yet.')).toBeVisible();
  await expect(page.getByTestId('registration-total')).toHaveText('0');
  await expect(page.locator('.recent-panel')).toContainText('No check-ins yet.');
  await admin.goto('/attendance');
  await admin.getByLabel('Participant ID', { exact: true }).fill(id);
  await admin.getByRole('button', { name: 'Confirm attendance' }).click();
  await expect(admin.getByRole('status')).toContainText('attendance is confirmed');
  await expect(page.getByTestId('registration-total')).toHaveText('1');
});
