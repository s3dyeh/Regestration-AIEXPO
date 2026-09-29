import { emptyStats } from '../supabase/functions/_shared/registration';
import { expect, test } from '@playwright/test';

test('operator access is independent of analytics; sessions survive reload and sign-out reaches other tabs', async ({
  page,
  context,
}) => {
  const id = '00000000-0000-4000-8000-000000000001';
  const jwt = [
    Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
    Buffer.from(
      JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' }),
    ).toString('base64url'),
    'test-signature',
  ].join('.');
  const user = {
    id,
    email: 'operator@example.com',
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  let allowed = true;
  let validAnalytics = false;
  await context.route('https://*.supabase.co/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = {};
    let status = 200;
    if (path.endsWith('/token'))
      body = {
        access_token: jwt,
        refresh_token: 'test-refresh',
        token_type: 'bearer',
        expires_in: 3600,
        user,
      };
    else if (path.endsWith('/user')) body = user;
    else if (path.endsWith('/event_operators'))
      body = allowed ? { event_id: 'a1c08e5d-0817-4684-a03e-1b37c24e1aa1' } : null;
    else if (path.endsWith('/admin_registrations')) body = { total: 0, rows: [] };
    // A successful legacy response must not be mistaken for denied account access.
    else if (path.endsWith('/event_statistics')) {
      const stats = emptyStats();
      stats.total = 1;
      stats.majors = [{ name: 'Computer Science', count: 1 }];
      stats.audience.dimensions.majorCategories = [
        { name: 'Not Provided', registered: 1, attended: 1, registeredMembers: 0, members: 0 },
      ];
      body = validAnalytics
        ? stats
        : { total: 0, majors: [], genders: [], timeline: [], recent: [], recentCount: 0 };
    } else if (path.endsWith('/logout')) status = 204;
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: status === 204 ? undefined : JSON.stringify(body),
    });
  });
  await page.goto('/admin');
  await page.getByLabel('Operator email', { exact: true }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill('test-only-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Register a participant', exact: true }),
  ).toBeAttached();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Register a participant', exact: true }),
  ).toBeAttached();
  const second = await context.newPage();
  await second.goto('/attendance');
  await expect(second.getByLabel('Participant ID', { exact: true })).toBeVisible();
  const dashboard = await context.newPage();
  await dashboard.goto('/dashboard');
  await expect(dashboard.getByRole('alert')).toContainText(
    'database needs the latest analytics update',
  );
  await expect(dashboard.getByTestId('registration-total')).toHaveCount(0);
  await expect(dashboard.getByLabel('Password', { exact: true })).toHaveCount(0);
  validAnalytics = true;
  await dashboard.reload();
  await expect(dashboard.locator('app-category-columns')).toContainText(
    'Computer Science and Information Technology',
  );
  await expect(dashboard.locator('app-category-columns')).not.toContainText('Not Provided');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(second.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(second.getByLabel('Participant ID', { exact: true })).toHaveCount(0);
  await expect(dashboard.getByLabel('Password', { exact: true })).toBeVisible();
  allowed = false;
  await page.getByLabel('Operator email', { exact: true }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill('test-only-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('does not have access');
  await expect(
    page.getByRole('heading', { name: 'Register a participant', exact: true }),
  ).toHaveCount(0);
});

for (const failure of [
  { status: 400, message: 'Check your email and password' },
  { status: 429, message: 'Too many sign-in attempts' },
  { status: 503, message: 'Could not reach the sign-in service' },
]) {
  test(`sign-in reports ${failure.status} accurately`, async ({ page, context }) => {
    await context.route('https://*.supabase.co/**', (route) =>
      route.fulfill({
        status: failure.status,
        contentType: 'application/json',
        body: JSON.stringify({ msg: 'Test failure' }),
      }),
    );
    await page.goto('/admin');
    await page.getByLabel('Operator email', { exact: true }).fill('operator@example.com');
    await page.getByLabel('Password', { exact: true }).fill('test-only-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText(failure.message, { timeout: 15000 });
    await expect(
      page.getByRole('heading', { name: 'Register a participant', exact: true }),
    ).toHaveCount(0);
  });
}
