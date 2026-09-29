import { expect, test } from '@playwright/test';
import { registerParticipant } from './participant-form';

test('individual registrations feed attendance analytics without counting absent participants', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const universities = [
    'The University of Jordan',
    'Princess Sumaya University for Technology',
    'Jordan University of Science and Technology',
    'Applied Science Private University',
    'German Jordanian University',
    'Yarmouk University',
    '',
  ];
  const majors = [
    'Computer Science',
    'Cybersecurity',
    'Business',
    'Artificial Intelligence',
    'Engineering',
    '',
    'Medicine',
  ];
  await page.goto('/admin');
  for (let index = 0; index < universities.length; index++) {
    await registerParticipant(page, {
      id: String(index + 1),
      name: `Participant ${index + 1}`,
      email: `person${index + 1}@example.com`,
      member: index < 4,
      role: index < 5 ? 'Undergraduate' : 'Graduate',
      university: universities[index],
      major: majors[index],
    });
  }
  await registerParticipant(page, {
    id: '8',
    name: 'Absent Person',
    email: 'absent@example.com',
    role: 'Academic / Researcher',
    university: 'Absent University',
    major: 'Chemistry',
  });
  const dashboard = await context.newPage();
  dashboard.on('pageerror', (error) => errors.push(error.message));
  await dashboard.emulateMedia({ reducedMotion: 'reduce' });
  await dashboard.goto('/dashboard');
  await expect(dashboard.getByTestId('registration-total')).toHaveText('0');
  await expect(dashboard.getByTestId('ieee-total')).toHaveText('0.0%');
  await expect(dashboard.locator('.recent-panel')).toContainText('No check-ins yet.');
  await dashboard.getByRole('button', { name: 'Realsoft — dashboard actions' }).click();
  await dashboard.getByRole('menuitem', { name: 'Pause welcomes' }).click();
  await page.goto('/attendance');
  for (let id = 1; id <= 7; id++) {
    await page.getByLabel('Participant ID', { exact: true }).fill(String(id));
    await page.getByRole('button', { name: 'Confirm attendance' }).click();
    await expect(page.getByRole('status')).toContainText('attendance is confirmed');
    await expect(dashboard.getByTestId('registration-total')).toHaveText(String(id));
    await expect(dashboard.getByTestId('ieee-total')).toHaveText(
      `${((Math.min(id, 4) / id) * 100).toFixed(1)}%`,
    );
    await expect(dashboard.locator('.recent-panel strong')).toHaveText(
      Array.from({ length: Math.min(id, 3) }, (_, index) => `Participant ${id - index}`),
    );
    if (id === 1) {
      await expect(dashboard.locator('app-category-columns')).toContainText(
        'Computer Science and Information Technology',
      );
      await expect(dashboard.locator('app-category-columns')).not.toContainText('Not Provided');
    }
    await page.keyboard.press('Shift+R');
  }
  await expect(dashboard.getByTestId('registration-total')).toHaveText('7');
  await page.getByLabel('Participant ID', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Confirm attendance', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('already been marked');
  await expect(dashboard.locator('.recent-panel strong')).toHaveText([
    'Participant 7',
    'Participant 6',
    'Participant 5',
  ]);
  for (const time of await dashboard.locator('.recent-panel time').all()) {
    const date = new Date((await time.getAttribute('datetime'))!);
    const jordanTime = new Date(date.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(11, 19);
    await expect(time).toHaveText(jordanTime);
  }
  await expect(dashboard.getByTestId('ieee-total')).toHaveText('57.1%');
  await expect(dashboard.locator('.membership-metric')).toContainText('4 / 7 checked-in attendees');
  await expect(dashboard.getByTestId('university-total')).toHaveText('6');
  await expect(dashboard.getByTestId('role-total')).toHaveCount(0);
  await expect(dashboard.locator('.metrics article')).toHaveCount(3);
  await expect(dashboard.locator('.roles-panel')).toContainText('71.4%');
  await expect(dashboard.locator('.universities-panel')).not.toContainText('Absent University');
  const universityChart = dashboard.locator('app-universities-chart');
  await expect(universityChart.locator('select, button, [role="button"]')).toHaveCount(0);
  await expect(universityChart.locator('li')).toHaveCount(4);
  await expect(universityChart.locator('.name')).toHaveText([
    'Applied Science Private University',
    'German Jordanian University',
    'Jordan University of Science and Technology',
    'Others',
  ]);
  await expect(universityChart.locator('.university-value strong')).toHaveText([
    '1',
    '1',
    '1',
    '4',
  ]);
  await expect(universityChart.locator('.other')).toContainText('57.1%');
  await expect(dashboard.getByRole('tab')).toHaveCount(0);
  await expect(dashboard.getByLabel('Analytics population')).toHaveCount(0);
  for (const text of [
    'Referral sources',
    'Records with review notes',
    'Available profile data',
    'REGISTERED',
    'AWAITING CHECK-IN',
    'JOINED IN THE LAST HOUR',
    'Connections over time.',
  ]) {
    await expect(dashboard.getByText(text, { exact: true })).toHaveCount(0);
  }
  for (const [width, height] of [
    [1920, 1080],
    [1280, 720],
    [375, 812],
  ]) {
    await dashboard.setViewportSize({ width, height });
    for (const title of ['Universities', 'Roles', 'Major categories', 'Latest 3 check-ins']) {
      await expect(dashboard.getByRole('heading', { name: title, exact: true })).toBeVisible();
    }
    expect(
      await dashboard.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    ).toBe(true);
    if (width >= 1000) {
      const metricBounds = await dashboard.locator('.metrics').boundingBox();
      const chartBounds = await dashboard.locator('.universities-panel').boundingBox();
      expect(chartBounds!.y).toBeGreaterThan(metricBounds!.y + metricBounds!.height);
      for (const card of await dashboard.locator('.metrics article').all()) {
        const bounds = await card.boundingBox();
        expect(bounds!.y + bounds!.height).toBeLessThan(chartBounds!.y);
      }

      expect(
        await dashboard.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1),
      ).toBe(true);
      await dashboard.screenshot({ path: `test-results/layout-${width}.png` });
      for (const panel of await dashboard
        .locator('app-universities-chart, app-profile-visual, app-category-columns')
        .all()) {
        expect(
          await panel.evaluate((el) => el.scrollHeight - el.clientHeight),
          `${width}: ${await panel.evaluate((el) => el.tagName)}`,
        ).toBeLessThanOrEqual(1);
      }
    }
    await dashboard.screenshot({
      path: `test-results/live-attendance-${width}.png`,
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});
