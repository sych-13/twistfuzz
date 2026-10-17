import { spawnSync } from 'node:child_process';

// The published preview must stay closed until live auth controls are validated.
// A remote project's old environment must not silently enable this integration.
const environment = { ...process.env, VITE_AUTH_INTEGRATION_READY: 'false' };
for (const arguments_ of [
  ['node_modules/typescript/bin/tsc', '-b'],
  ['node_modules/vite/bin/vite.js', 'build'],
]) {
  const result = spawnSync(process.execPath, arguments_, { env: environment, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
