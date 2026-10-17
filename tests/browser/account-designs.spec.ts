import { test, expect } from '@playwright/test';

test('account designs remain gated and separate from working browser-local drafts', async ({ page }) => {
  const calls: string[] = [];
  page.on('request', request => { if (request.url().includes('/functions/v1/')) calls.push(request.url()); });
  await page.goto('/studio?role=customer');
  const account = page.getByRole('region', { name: 'Saved to your account' });
  await expect(account).toContainText('pending authentication setup and security validation');
  await expect(page.getByRole('button', { name: 'Save as new account design' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Save preview draft' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Preview draft saved' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(account).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await account.screenshot({ path: 'docs/qa/v0.5.0-dev.5-account-designs-pending-mobile.png' });
  expect(calls).toEqual([]);
});
