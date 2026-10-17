import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const hashes = JSON.parse(readFileSync(new URL('../asset-hashes.json', import.meta.url), 'utf8'));

test('public routes render, including direct links, redirects and unknown routes', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const [route, heading] of [
    ['/', 'Crafted with heart, styled with grace.'],
    ['/shop', 'Thoughtful gifts, handmade.'],
    ['/lookbook', 'Crafted with heart, styled with grace.'],
    ['/studio', 'Your own 3D Bloom Studio'],
    ['/home', 'Crafted with heart, styled with grace.'],
    ['/missing', "Oops, that flower hasn't bloomed yet."],
  ]) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading, { useInnerText: true });
    if (route === '/studio') {
      await expect(page.locator('canvas')).toBeVisible();
      await expect(page.getByRole('button', { name: /Add to Cart/ })).toBeDisabled();
    }
  }
  expect(errors).toEqual([]);
});

test('separate portals stay closed and privileged signup is absent', async ({ page }) => {
  for (const [login, dashboard, title] of [
    ['/login', '/account', 'Welcome back to the garden.'],
    ['/staff/login', '/staff/dashboard', 'Staff Portal'],
    ['/admin/login', '/admin/dashboard', 'Admin Portal'],
  ]) {
    await page.goto(dashboard);
    await expect(page).toHaveURL(new RegExp(`${login}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeDisabled();
    await expect(page.getByText(/Authentication setup pending/)).toBeVisible();
    if (login !== '/login') {
      await expect(page.getByRole('button', { name: /Google|Create an account|Forgot password/ })).toHaveCount(0);
    }
  }
});

test('all 24 preserved images decode successfully in a browser', async ({ page }) => {
  await page.goto('/');
  const invalid = await page.evaluate(async files => {
    const results = await Promise.all(files.map(async file => {
      const image = new Image();
      image.src = `/${file}`;
      try {
        await image.decode();
        return image.naturalWidth > 0 && image.naturalHeight > 0 ? null : file;
      } catch { return file; }
    }));
    return results.filter(Boolean);
  }, Object.keys(hashes));
  expect(invalid).toEqual([]);
});

test('mobile navigation and main layouts fit a 390px screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Toggle menu' }).click();
  await page.getByRole('link', { name: '3D Studio', exact: true }).click();
  await expect(page).toHaveURL(/\/studio$/);
  for (const route of ['/', '/shop', '/lookbook', '/studio', '/login', '/staff/login', '/admin/login']) {
    await page.goto(route);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
