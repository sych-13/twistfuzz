import { test, expect } from '@playwright/test';
import { DRAFT_KEY } from '../../src/features/studio/drafts';
import { defaultDesign } from '../../src/features/studio/design';
import { readFileSync } from 'node:fs';
const qaVersion = `v${JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version}`;

test('save, reload, reopen, reset and remove preserve the complete preview design', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/studio');
  const summary = page.getByRole('region', { name: 'Your bouquet at a glance' });
  await page.getByRole('button', { name: 'Rose', exact: true }).click();
  await page.getByRole('button', { name: 'Blue Rose', exact: true }).click();
  await page.getByRole('button', { name: 'Add selected stem' }).click();
  await page.getByLabel('4. Wrapper style').selectOption('Elegant Black');
  await page.getByLabel('5. Ribbon', { exact: true }).selectOption('No Ribbon');
  await page.getByLabel('Add a message card').check();
  await page.getByRole('button', { name: 'Save preview draft' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status').filter({ hasText: 'Preview draft saved' })).toBeVisible();
  const saved = await page.evaluate(key => localStorage.getItem(key), DRAFT_KEY);
  expect(JSON.parse(saved!).design.flowers).toContainEqual({ kind: 'Rose', color: '#467cc4', count: 1 });
  await page.reload();
  await expect(summary).toContainText('5 / 30 stems');
  // Opening the studio does not silently replace unsaved work with a stored draft.
  expect(await page.evaluate(key => localStorage.getItem(key), DRAFT_KEY)).toBe(saved);
  await page.getByRole('button', { name: 'Reopen saved draft' }).click();
  await expect(summary).toContainText('6 / 30 stems');
  await expect(summary).toContainText('1 × Blue Rose');
  await expect(page.getByLabel('4. Wrapper style')).toHaveValue('Elegant Black');
  await expect(page.getByLabel('5. Ribbon', { exact: true })).toHaveValue('No Ribbon');
  await expect(page.getByLabel('Add a message card')).toBeChecked();
  await page.getByRole('button', { name: 'Reset bouquet' }).click();
  await expect(summary).toContainText('5 / 30 stems');
  await expect(page.getByLabel('4. Wrapper style')).toHaveValue('Pastel Pink');
  await expect(page.getByLabel('Add a message card')).not.toBeChecked();
  expect(await page.evaluate(key => localStorage.getItem(key), DRAFT_KEY)).toBe(saved);
  await page.getByRole('button', { name: 'Reopen saved draft' }).click();
  await expect(summary).toContainText('6 / 30 stems');
  await page.getByRole('button', { name: 'Remove saved draft' }).click();
  await expect(summary).toContainText('6 / 30 stems');
  expect(await page.evaluate(key => localStorage.getItem(key), DRAFT_KEY)).toBeNull();
  await page.getByRole('button', { name: 'Reopen saved draft' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'There is no preview draft' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('invalid and over-limit storage never replaces the current bouquet', async ({ page }) => {
  await page.goto('/studio');
  await page.getByRole('button', { name: 'Add selected stem' }).click();
  const invalid = ['{broken', JSON.stringify({ version: 1, savedAt: '2026-10-16T13:00:00.000Z', design: {
    ...defaultDesign(), flowers: [{ kind: 'Tulip', color: '#f3a2bf', count: 31 }],
  } })];
  for (const raw of invalid) {
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: DRAFT_KEY, value: raw });
    await page.getByRole('button', { name: 'Reopen saved draft' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Your bouquet at a glance' })).toContainText('6 / 30 stems');
    expect(await page.evaluate(key => localStorage.getItem(key), DRAFT_KEY)).toBe(raw);
  }
});

test('blocked browser storage leaves the builder usable with accessible feedback', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
  });
  await page.goto('/studio');
  await expect(page.getByRole('alert')).toContainText('Browser storage is unavailable');
  await page.getByRole('button', { name: 'Add selected stem' }).click();
  await page.getByRole('button', { name: 'Save preview draft' }).click();
  await expect(page.getByRole('alert')).toContainText('Draft could not be saved');
  await expect(page.getByRole('region', { name: 'Your bouquet at a glance' })).toContainText('6 / 30 stems');
  await page.getByRole('button', { name: 'Remove saved draft' }).click();
  await expect(page.getByRole('alert')).toContainText('could not be removed');
});

test('quota failures keep the previous saved draft and current bouquet', async ({ page }) => {
  await page.goto('/studio');
  await page.getByRole('button', { name: 'Save preview draft' }).click();
  const saved = await page.evaluate(key => localStorage.getItem(key), DRAFT_KEY);
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); }; });
  await page.getByRole('button', { name: 'Add selected stem' }).click();
  await page.getByRole('button', { name: 'Save preview draft' }).click();
  await expect(page.getByRole('alert')).toContainText('Draft could not be saved');
  expect(await page.evaluate(key => localStorage.getItem(key), DRAFT_KEY)).toBe(saved);
  await expect(page.getByRole('region', { name: 'Your bouquet at a glance' })).toContainText('6 / 30 stems');
});

test('stem controls enforce 30 and allow an empty bouquet draft', async ({ page }) => {
  await page.goto('/studio');
  const add = page.getByRole('button', { name: 'Add selected stem' });
  for (let i = 0; i < 25; i++) await add.click();
  await expect(add).toBeDisabled();
  await expect(page.getByText('30-stem maximum reached.', { exact: false })).toBeVisible();
  for (let i = 0; i < 28; i++) await page.getByRole('button', { name: 'Remove selected stem' }).click();
  await expect(page.getByRole('button', { name: 'Remove selected stem' })).toBeDisabled();
  await page.getByRole('button', { name: 'Daisy', exact: true }).click();
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Remove selected stem' }).click();
  await expect(page.getByText('No stems yet.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Save preview draft' }).click();
  await page.getByRole('button', { name: 'Reset bouquet' }).click();
  await page.getByRole('button', { name: 'Reopen saved draft' }).click();
  await expect(page.getByRole('region', { name: 'Your bouquet at a glance' })).toContainText('0 / 30 stems');
});

test('the bouquet remains editable when WebGL cannot initialize', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
      return original.call(this, type, ...args);
    } as typeof original;
  });
  await page.goto('/studio');
  await expect(page.getByText('3D preview is unavailable', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Add selected stem' }).click();
  await page.getByRole('button', { name: 'Save preview draft' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Preview draft saved' })).toBeVisible();
});

test('customer registration state cannot leak into privileged portals', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'New here? Create an account' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Create your account');
  await page.getByRole('link', { name: 'Staff', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Staff Portal');
  await expect(page.getByRole('button', { name: 'Register', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Admin', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Admin Portal');
  await expect(page.getByRole('button', { name: 'Register', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Email address')).toBeDisabled();
  await expect(page.getByLabel('Password', { exact: true })).toBeDisabled();
});

test('capture desktop and mobile studio evidence', async ({ page }) => {
  await page.goto('/studio');
  await expect(page.locator('canvas')).toBeVisible();
  await page.screenshot({ path: `docs/qa/${qaVersion}-studio-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `docs/qa/${qaVersion}-studio-mobile.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: `docs/qa/${qaVersion}-home-desktop.png`, fullPage: true });
});

test('another tab can update the stored draft without replacing current work', async ({ page, context }) => {
  await page.goto('/studio');
  await page.getByRole('button', { name: 'Add selected stem' }).click();
  const otherTab = await context.newPage();
  await otherTab.goto('/shop');
  await otherTab.evaluate(({ key, draft }) => localStorage.setItem(key, JSON.stringify(draft)), {
    key: DRAFT_KEY,
    draft: { version: 1, savedAt: '2026-10-16T13:00:00.000Z', design: { ...defaultDesign(), wrapper: 'Kraft Brown' } },
  });
  await expect(page.getByRole('status').filter({ hasText: 'changed in another tab' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Your bouquet at a glance' })).toContainText('6 / 30 stems');
  await page.getByRole('button', { name: 'Reopen saved draft' }).click();
  await expect(page.getByLabel('4. Wrapper style')).toHaveValue('Kraft Brown');
  await expect(page.getByRole('region', { name: 'Your bouquet at a glance' })).toContainText('5 / 30 stems');
  await otherTab.close();
});
