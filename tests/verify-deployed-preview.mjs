import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

// Read-only hosting checks, plus drafts isolated to a disposable browser profile.
// The short-lived local OIDC token never enters results, screenshots or Git.
const target = new URL(process.argv[2]);
assert.match(target.hostname, /^twistfuzz-bloom-preview-[a-z0-9]+-icarus9963-7076\.vercel\.app$/);
assert.equal(target.protocol, 'https:');
assert.equal(target.href, `${target.origin}/`);
process.loadEnvFile('.env.local');
assert.ok(process.env.VERCEL_OIDC_TOKEN, 'Refresh local Vercel development authentication first.');
const hashes = JSON.parse(readFileSync('tests/asset-hashes.json', 'utf8'));
const result = { url: target.origin, checkedAt: new Date().toISOString(), checks: [], passed: false };
const browser = await chromium.launch({ channel: 'msedge', args: ['--enable-unsafe-swiftshader'] });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route('**/*', async route => {
    const request = route.request();
    if (new URL(request.url()).origin !== target.origin) return route.continue();
    return route.continue({ headers: { ...request.headers(), 'x-vercel-trusted-oidc-idp-token': process.env.VERCEL_OIDC_TOKEN } });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', () => errors.push('browser runtime error'));
  for (const [path, title] of [
    ['/', 'Crafted with heart, styled with grace.'], ['/shop', 'Thoughtful gifts, handmade.'],
    ['/lookbook', 'Crafted with heart, styled with grace.'], ['/studio', 'Your own 3D Bloom Studio'],
    ['/missing', "Oops, that flower hasn't bloomed yet."],
  ]) {
    const response = await page.goto(`${target.origin}${path}`);
    assert.equal(response.status(), 200, `Hosted route ${path}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title, { useInnerText: true });
    result.checks.push(`direct route ${path}`);
  }
  for (const [path, login, title] of [
    ['/account', '/login', 'Welcome back to the garden.'],
    ['/staff/dashboard', '/staff/login', 'Staff Portal'],
    ['/admin/dashboard', '/admin/login', 'Admin Portal'],
  ]) {
    await page.goto(`${target.origin}${path}`);
    await expect(page).toHaveURL(`${target.origin}${login}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeDisabled();
    await expect(page.getByLabel('Email address')).toBeDisabled();
    if (login !== '/login') await expect(page.getByRole('button', { name: /Google|Create an account|Forgot password/ })).toHaveCount(0);
    result.checks.push(`closed portal ${path}`);
  }
  await page.goto(`${target.origin}/studio`);
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: /Add to Cart/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Rose', exact: true }).click();
  await page.getByRole('button', { name: 'Blue Rose', exact: true }).click();
  await page.getByRole('button', { name: 'Add selected stem' }).click();
  await page.getByRole('button', { name: 'Save preview draft' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Reopen saved draft' }).click();
  await expect(page.getByRole('region', { name: 'Your bouquet at a glance' })).toContainText('6 / 30 stems');
  result.checks.push('3D studio, closed checkout and local draft save/reopen');
  const invalidAssets = await page.evaluate(async hashes => {
    const failures = [];
    for (const [path, expected] of Object.entries(hashes)) {
      const response = await fetch(`/${path}`);
      const bytes = await response.arrayBuffer();
      const actual = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
      if (!response.ok || actual !== expected) failures.push(path);
      const image = new Image(); image.src = `/${path}`;
      try { await image.decode(); if (!image.naturalWidth) failures.push(path); } catch { failures.push(path); }
    }
    return failures;
  }, hashes);
  assert.deepEqual(invalidAssets, []);
  result.checks.push('all 24 hosted original images match SHA-256 and decode');
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ['/', '/studio', '/login', '/staff/login', '/admin/login']) {
    await page.goto(`${target.origin}${path}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Mobile fit ${path}`);
  }
  result.checks.push('five mobile route layouts fit 390px');
  assert.deepEqual(errors, []);
  result.checks.push('no browser runtime errors');
  await page.goto(target.origin);
  await page.screenshot({ path: 'docs/qa/vercel-deployed-home-mobile.png', fullPage: true });
  await page.goto(`${target.origin}/studio`);
  await expect(page.getByRole('heading', { name: 'Your own 3D Bloom Studio' })).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await page.screenshot({ path: 'docs/qa/vercel-deployed-studio-mobile.png', fullPage: true });
  result.passed = true;
} finally {
  await browser.close();
  writeFileSync('docs/qa/vercel-deployed-preview-results.json', `${JSON.stringify(result, null, 2)}\n`);
}
console.log(`PASS: ${result.checks.length} deployed preview checks, including 24 original assets.`);
