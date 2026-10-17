import { spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
mkdirSync(new URL('../docs/qa/', import.meta.url), { recursive: true });
const result = spawnSync(process.execPath, [
  '--experimental-strip-types', '--test', '--test-reporter=spec', '--test-reporter=tap',
  '--test-reporter-destination=stdout', `--test-reporter-destination=docs/qa/v${version}-database.tap`,
  'tests/database.test.mjs',
], { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
