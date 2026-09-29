import { expect, test } from '@playwright/test';
import { fillParticipant, registerParticipant } from './participant-form';

test('individual registration validates fields, skips existing IDs and preserves attendance', async ({
  page,
  context,
}) => {
  await page.goto('/admin');
  await expect(page.locator('input[type=file]')).toHaveCount(0);
  await expect(page.getByLabel('Phone number', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: 'Phone', exact: true })).toHaveCount(0);
  await expect(page.getByText('Download CSV template')).toHaveCount(0);
  await page.getByRole('button', { name: 'Register participant', exact: true }).click();
  await expect(page.locator('mat-error').first()).toBeVisible();
  const dashboard = await context.newPage();
  await dashboard.goto('/dashboard');
  await dashboard.getByRole('button', { name: 'Realsoft — dashboard actions' }).click();
  await dashboard.getByRole('menuitem', { name: 'Pause welcomes' }).click();
  await registerParticipant(page, { id: '1', name: 'Original Name' });
  await expect(page.getByLabel('Participant ID', { exact: true })).toHaveValue('');
  await expect(page.locator('mat-error')).toHaveCount(0);
  await expect(dashboard.getByTestId('registration-total')).toHaveText('0');
  await page.goto('/attendance');
  await page.getByLabel('Participant ID', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Confirm attendance' }).click();
  await expect(page.getByRole('status')).toContainText('Original Name');
  await expect(dashboard.getByTestId('registration-total')).toHaveText('1');
  await page.goto('/admin');
  await fillParticipant(page, { id: '001', name: 'Overwrite Attempt', member: false });
  await page.getByRole('button', { name: 'Register participant', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('ID already exists');
  await expect(page.locator('tbody')).toContainText('Original Name');
  await expect(page.locator('tbody')).not.toContainText('Overwrite Attempt');
  await registerParticipant(page, { id: '002', name: 'New Person', member: false });
  await expect(dashboard.getByTestId('registration-total')).toHaveText('1');
  await expect(dashboard.getByTestId('ieee-total')).toHaveText('100.0%');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/participant-form-mobile.png', fullPage: true });
});
