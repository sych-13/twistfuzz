import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const version = `v${JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version}`;

test('unconfigured portals cannot be enabled by query parameters, local role data or an enrollment URL', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('role', 'admin'); localStorage.setItem('mfa_verified', 'true'); });
  await page.goto('/admin/login?role=admin&mfa_verified=true');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Admin Portal');
  await expect(page.getByLabel('Email address')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Verify and continue' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /register|reset password|skip/i })).toHaveCount(0);
  await page.goto('/admin/setup-mfa');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText("Oops, that flower hasn't bloomed yet.");
});

test('portal screenshots preserve Elegant Garden on desktop and mobile', async ({ page }) => {
  for (const [portal, url] of [['customer', '/login'], ['staff', '/staff/login'], ['admin', '/admin/login']]) {
    await page.goto(url);
    await expect(page.getByLabel('Email address')).toBeDisabled();
    await page.screenshot({ path: `docs/qa/${version}-${portal}-login-desktop.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `docs/qa/${version}-${portal}-login-mobile.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
});

test('static MFA visual fixture fits desktop and mobile without adding an app login bypass', async ({ page }) => {
  await page.goto('/admin/login');
  const html = readFileSync(new URL(`../../docs/qa/${version}-mfa-static.html`, import.meta.url), 'utf8');
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Verify your sign-in' })).toBeVisible();
  await page.screenshot({ path: `docs/qa/${version}-admin-mfa-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `docs/qa/${version}-admin-mfa-mobile.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
