import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('Vite refuses private credentials before emitting a browser bundle', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  for (const [index, fixture] of [
    { VITE_SUPABASE_ANON_KEY: 'sb_secret_fixture-never-a-real-key' },
    { VITE_FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----fixture-never-a-real-key' },
  ].entries()) {
    const output = `test-results/private-key-guard-${index}`;
    const result = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', output], {
      cwd: root, env: { ...process.env, ...fixture }, encoding: 'utf8', timeout: 15000,
    });
    const logs = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    assert.equal(result.error, undefined);
    assert.notEqual(result.status, 0);
    assert.match(logs, /Private keys cannot|Refusing private credentials/);
    assert.ok(!logs.includes('fixture-never-a-real-key'), 'Build logs must not echo credential values');
    assert.equal(existsSync(fileURLToPath(new URL(`../${output}/index.html`, import.meta.url))), false);
  }
});
