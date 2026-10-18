import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Produces source-only JSON for the Supabase deployment tool. This script does
// not read environment files or credentials and does not deploy by itself.
const name = process.argv[2];
if (!['resolve-role', 'provision-customer', 'saved-designs'].includes(name)) throw Error('Unsupported function');
const root = fileURLToPath(new URL('../', import.meta.url));
const files = [];
const seen = new Set();
function include(file) {
  const absolute = path.resolve(root, file);
  if (!absolute.startsWith(root)) throw Error('Dependency outside app');
  if (seen.has(absolute)) return;
  seen.add(absolute);
  const content = readFileSync(absolute, 'utf8');
  files.push({ name: path.relative(root, absolute).replaceAll('\\', '/'), content });
  for (const match of content.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
    let dependency = path.resolve(path.dirname(absolute), match[1]);
    if (!existsSync(dependency)) dependency += '.ts';
    include(dependency);
  }
}
const entrypoint_path = `supabase/functions/${name}/index.ts`;
include(entrypoint_path);
include('supabase/functions/deno.json');
include('supabase/functions/deno.lock');
console.log(JSON.stringify({ entrypoint_path, import_map_path: 'supabase/functions/deno.json', files }));
