import { test, expect, type Page } from '@playwright/test';
const action = (page: Page, name: string) => page.locator(`[data-action="${name}"]`).first();
async function command(page: Page, text: string) {
  const input = page.getByRole('textbox', { name: 'اكتب أمر Git', exact: true });
  await input.fill(text);
  await input.press('Enter');
}
async function edit(page: Page, file: string, text: string) {
  await page.locator('#file-select').selectOption(file);
  await page.locator('#file-content').fill(text);
  await action(page, 'save-file').click();
}
async function next(page: Page, id: string) {
  await expect(action(page, 'next')).toBeEnabled();
  await action(page, 'next').click();
  await expect(page.locator('.wizard')).toHaveAttribute('data-step', id);
}
async function commit(page: Page) {
  await command(page, 'git add .');
  await command(page, 'git commit -m "Snapshot"');
}

test('single continuous wizard completes every challenge offline and repeats', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', (route) =>
    new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort(),
  );
  await page.goto('/learn-git');
  await expect(page.locator('a')).toHaveCount(2);
  await expect(action(page, 'next')).toBeDisabled();
  await action(page, 'intro:sara').click();
  await expect(page.locator('.lost-change')).toContainText('Time: 12:00');
  await command(page, 'git init');
  await page.screenshot({ path: 'test-results/wizard-problem.png', fullPage: true });
  await next(page, 'first');
  await commit(page);
  await next(page, 'staging');
  await page.getByRole('button', { name: 'غيّر المكان إلى Auditorium', exact: true }).click();
  await action(page, 'save-file').click();
  await command(page, 'git add event.txt');
  await page.getByRole('button', { name: 'غيّر المكان إلى Library', exact: true }).click();
  await action(page, 'save-file').click();
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await expect(action(page, 'next')).toBeDisabled();
  await page.getByRole('button', { name: 'Auditorium', exact: true }).click();
  await command(page, 'git commit -m "Staged"');
  await expect(page.locator('.saved pre')).toContainText('Auditorium');
  await expect(page.locator('.working pre')).toContainText('Library');
  await page.screenshot({ path: 'test-results/wizard-staging.png', fullPage: true });
  await next(page, 'save');
  await command(page, 'git diff');
  await commit(page);
  await next(page, 'branch');
  await command(page, 'git switch -c venue');
  await edit(page, 'event.txt', 'Event: Campus Code Day\nVenue: Auditorium\nTime: 10:00');
  await commit(page);
  await next(page, 'merge');
  await command(page, 'git switch main');
  await page.getByRole('button', { name: 'أضف Workshop إلى البرنامج' }).click();
  await expect(page.locator('#file-select')).toHaveValue('program.txt');
  await action(page, 'save-file').click();
  await commit(page);
  await command(page, 'git merge venue');
  await action(page, 'commit:c006').click();
  await expect(page.locator('.commit-details')).toContainText('c005 + c004');
  await action(page, 'close').click();
  await next(page, 'time-branch');
  await command(page, 'git switch -c time');
  await edit(page, 'event.txt', 'Event: Campus Code Day\nVenue: Auditorium\nTime: 12:00');
  await commit(page);
  await next(page, 'collision');
  await command(page, 'git switch main');
  await edit(page, 'event.txt', 'Event: Campus Code Day\nVenue: Auditorium\nTime: 14:00');
  await commit(page);
  await command(page, 'git merge time');
  await next(page, 'abort');
  await command(page, 'git merge --abort');
  await expect(page.locator('.recovery-scene')).toContainText('لا دمج جارٍ');
  await page.screenshot({ path: 'test-results/wizard-abort.png', fullPage: true });
  await next(page, 'retry-merge');
  await command(page, 'git merge time');
  await next(page, 'resolve');
  await expect(page.locator('#file-content')).toHaveValue(/<<<<<<< HEAD/);
  await command(page, 'git add event.txt');
  await expect(page.locator('.output-error').last()).toContainText('Remove conflict markers');
  await expect(action(page, 'next')).toBeDisabled();
  await page.screenshot({ path: 'test-results/wizard-conflict.png', fullPage: true });
  await edit(page, 'event.txt', 'Event: Campus Code Day\nVenue: Auditorium\nTime: 13:00');
  await commit(page);
  await next(page, 'push');
  await command(page, 'git remote -v');
  await command(page, 'git push');
  await next(page, 'fetch');
  await command(page, 'git fetch');
  await expect(page.locator('.network-machines article').first()).not.toContainText(
    '15:00 Testing',
  );
  await page.screenshot({ path: 'test-results/wizard-fetch.png', fullPage: true });
  await next(page, 'pull');
  await command(page, 'git pull --ff-only');
  await next(page, 'local-error');
  const program = '10:00 Welcome\n11:00 Git booth\n13:00 Workshop\n15:00 Testing';
  await edit(page, 'program.txt', program + '\n16:00 Wrong');
  await commit(page);
  await next(page, 'amend');
  await page.getByRole('button', { name: 'صحّح Wrong إلى Review', exact: true }).click();
  await action(page, 'save-file').click();
  await command(page, 'git add program.txt');
  await command(page, 'git commit --amend -m "Review session"');
  await expect(page.locator('.operation-changed')).toBeVisible();
  await expect(page.locator('.detached-commit')).toHaveCount(1);
  await page.screenshot({ path: 'test-results/wizard-amend.png', fullPage: true });
  await next(page, 'soft-reset');
  await command(page, 'git reset --soft HEAD~1');
  await expect(page.locator('.recovery-files')).toContainText('Review');
  await next(page, 'recommit');
  await command(page, 'git commit -m "Reviewed schedule"');
  await next(page, 'unstage');
  await page.getByRole('button', { name: 'غيّر المكان إلى Courtyard', exact: true }).click();
  await action(page, 'save-file').click();
  await command(page, 'git add event.txt');
  await command(page, 'git restore --staged event.txt');
  await next(page, 'discard');
  await command(page, 'git restore event.txt');
  await next(page, 'stash-save');
  await page.getByRole('button', { name: 'أضف مسودة Draft', exact: true }).click();
  await action(page, 'save-file').click();
  await command(page, 'git add program.txt');
  await command(page, 'git stash push -m "Draft"');
  await expect(page.locator('.stash-entry')).toContainText('17:00 Draft');
  await expect(page.locator('.stash-working > pre')).not.toContainText('17:00 Draft');
  await page.screenshot({ path: 'test-results/wizard-stash.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/wizard-stash-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await next(page, 'stash-apply');
  await command(page, 'git switch venue');
  await command(page, 'git switch main');
  await command(page, 'git stash apply');
  await expect(page.locator('.stash-entry')).toHaveCount(1);
  await next(page, 'stash-drop');
  await command(page, 'git stash drop');
  await commit(page);
  await next(page, 'stash-pop');
  await page.getByRole('button', { name: 'أضف مسودة Demo', exact: true }).click();
  await action(page, 'save-file').click();
  await command(page, 'git stash push -m "Demo"');
  await command(page, 'git stash pop');
  await expect(page.locator('.stash-entry')).toHaveCount(0);
  await commit(page);
  await next(page, 'stash-conflict');
  await page.getByRole('button', { name: 'مسودة Courtyard', exact: true }).click();
  await action(page, 'save-file').click();
  await command(page, 'git stash');
  await page.getByRole('button', { name: 'قرار جديد: Studio', exact: true }).click();
  await action(page, 'save-file').click();
  await commit(page);
  await command(page, 'git stash pop');
  await expect(page.locator('.stash-result')).toHaveClass(/has-conflict/);
  await expect(page.locator('.stash-entry')).toHaveCount(1);
  await page.screenshot({ path: 'test-results/wizard-stash-conflict.png', fullPage: true });
  await next(page, 'stash-resolve');
  await edit(page, 'event.txt', 'Event: Campus Code Day\nVenue: Courtyard\nTime: 13:00');
  await commit(page);
  await command(page, 'git stash drop');
  await next(page, 'shared-error');
  await page.getByRole('button', { name: 'انشر خطأ تجريبيًا', exact: true }).click();
  await action(page, 'save-file').click();
  await commit(page);
  await command(page, 'git push');
  await next(page, 'revert');
  await command(page, 'git reset --soft HEAD~1');
  await expect(page.locator('.output-error').last()).toContainText('Lab guardrail');
  await expect(action(page, 'next')).toBeDisabled();
  await command(page, 'git revert HEAD');
  await command(page, 'git push');
  await page.screenshot({ path: 'test-results/wizard-revert.png', fullPage: true });
  await next(page, 'team-diverge');
  await page.getByRole('button', { name: 'غيّر الوقت إلى 14:00', exact: true }).click();
  await action(page, 'save-file').click();
  await commit(page);
  await command(page, 'git push');
  await expect(page.locator('.output-error').last()).toContainText('Push rejected');
  await next(page, 'team-sync');
  await command(page, 'git fetch');
  await command(page, 'git pull --ff-only');
  await expect(page.locator('.output-error').last()).toContainText('Not possible to fast-forward');
  await command(page, 'git merge origin/main');
  await command(page, 'git push');
  await page.screenshot({ path: 'test-results/wizard-team-sync.png', fullPage: true });
  await next(page, 'finish');
  await expect(page.locator('.finish-result')).toContainText('15:00 Testing');
  await expect(page.locator('a')).toHaveCount(2);
  await action(page, 'repeat').click();
  await expect(page.locator('.wizard')).toHaveAttribute('data-step', 'problem');
  await expect(action(page, 'next')).toBeDisabled();
  await expect(page.locator('.repository-seed')).toContainText('0 commits');
  expect(errors).toEqual([]);
});

test('keyboard, command suggestions, retry and reset', async ({ page }) => {
  await page.goto('/learn-git');
  await page.getByRole('button', { name: 'git init', exact: true }).click();
  const input = page.getByRole('textbox', { name: 'اكتب أمر Git', exact: true });
  await expect(input).toHaveValue('git init');
  await expect(action(page, 'next')).toBeDisabled();
  await input.press('Enter');
  await action(page, 'intro:omar').click();
  await next(page, 'first');
  await input.fill('git sta');
  await input.press('Tab');
  await expect(input).toHaveValue('git status');
  await input.press('Enter');
  await input.press('ArrowUp');
  await expect(input).toHaveValue('git status');
  await commit(page);
  await action(page, 'retry').click();
  await expect(page.locator('.saved pre')).toContainText('لم يُتتبع بعد');
  await expect(action(page, 'next')).toBeDisabled();
  await commit(page);
  await next(page, 'staging');
  await action(page, 'solution').click();
  await expect(page.locator('#file-content')).toHaveValue(/Auditorium/);
  await page.getByRole('button', { name: 'إعادة الجولة', exact: true }).click();
  await action(page, 'confirm-reset').click();
  await expect(page.locator('.wizard')).toHaveAttribute('data-step', 'problem');
});
test('solution performs one remaining action without timers, replay or losing manual work', async ({
  page,
}) => {
  await page.clock.install();
  // Keep Angular’s render scheduler running; advance time below to detect automatic replay.
  await page.goto('/learn-git');
  await action(page, 'intro:omar').click();
  await action(page, 'solution').click();
  await expect(page.locator('.lost-change')).toContainText('Venue: Auditorium');
  await expect(page.locator('.terminal-output')).toContainText('git init');
  await next(page, 'first');
  const editor = page.locator('#file-content');
  await editor.fill((await editor.inputValue()) + '\nStudent note: keep me');
  await action(page, 'solution').click();
  await expect(page.locator('.working pre')).toContainText('keep me');
  await expect(page.locator('.staged pre')).toContainText('لم يُتتبع بعد');
  await page.clock.runFor(60000);
  await expect(page.locator('.saved pre')).toContainText('لم يُتتبع بعد');
  await command(page, 'git add .');
  await action(page, 'solution').click();
  await expect(page.locator('.saved pre')).toContainText('keep me');
  await expect(action(page, 'next')).toBeEnabled();
  await expect(page.locator('.solution-player')).toHaveCount(0);
  await next(page, 'staging');
  await editor.fill((await editor.inputValue()).replace('Room A', 'Auditorium'));
  await action(page, 'save-file').click();
  await command(page, 'git add event.txt');
  await action(page, 'solution').click();
  await expect(editor).toHaveValue(/Library/);
  await expect(page.locator('.staged pre')).toContainText('Auditorium');
  await expect(editor).toHaveValue(/keep me/);
  await page.screenshot({ path: 'test-results/wizard-one-step-solution.png', fullPage: true });
});

for (const width of [390, 768])
  test(`responsive wizard ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/learn-git');
    await expect(page.locator('h1')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await action(page, 'intro:sara').click();
    await command(page, 'git init');
    await next(page, 'first');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/wizard-${width}.png`, fullPage: true });
  });
