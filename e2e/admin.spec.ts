import { expect, test } from '@playwright/test';
import ExcelJS from 'exceljs';
import { readFile } from 'node:fs/promises';

test('admin paginates and exports every registration, without phone columns', async ({ page }) => {
  await page.goto('/dashboard');
  for (const total of [12, 24, 36]) {
    await page.getByRole('button', { name: 'Add demo arrivals' }).click();
    await expect(page.getByTestId('registration-total')).toHaveText(String(total));
  }
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Attendance administration.' })).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(10);
  await expect(page.getByRole('button', { name: /edit|delete|add registration/i })).toHaveCount(0);
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(10);
  await page.getByRole('button', { name: 'Last page' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(6);
  await page.getByRole('button', { name: 'Previous page' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(10);
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export attendance to Excel' }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  const data = await readFile((await download.path())!);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Uint8Array.from(data).buffer);
  const sheet = workbook.getWorksheet('Attendance')!;
  expect(sheet.rowCount).toBe(37);
  expect(sheet.getRow(1).values).not.toContain('Phone number');
  expect(sheet.getRow(1).values).not.toContain('Phone (as imported)');

  await page.screenshot({ path: 'test-results/admin-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/admin-mobile.png', fullPage: true });
});

test('empty admin list can still export a workbook with headers', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByText('No attendance recorded yet.')).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export attendance to Excel' }).click();
  const data = await readFile((await (await downloaded).path())!);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Uint8Array.from(data).buffer);
  expect(workbook.getWorksheet('Attendance')!.rowCount).toBe(1);
});
