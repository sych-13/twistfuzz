import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
export const fixtureProject = 'twistfuzz-local-tests';
export function fixtureClaims(uid, overrides = {}) {
  const seconds = Math.floor(Date.now() / 1000);
  return { sub: uid, iss: `https://securetoken.google.com/${fixtureProject}`, aud: fixtureProject,
    role: 'authenticated', email_verified: true, iat: seconds - 5, auth_time: seconds - 60,
    exp: seconds + 3500, firebase: { sign_in_provider: 'password' }, ...overrides };
}

export async function localDatabase() {
  // In-memory Postgres/WASM only: no connection URL, listener or external DB.
  const database = new PGlite({ extensions: { pgcrypto } });
  await database.exec(`
    create role anon nologin nosuperuser nobypassrls;
    create role authenticated nologin nosuperuser nobypassrls;
    create role service_role nologin nosuperuser bypassrls;
    create schema auth;
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
    $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant execute on function auth.jwt() to anon, authenticated, service_role;
  `);
  const migrations = new URL('supabase/migrations/', root);
  for (const file of readdirSync(migrations).filter(name => name.endsWith('.sql')).sort()) {
    await database.exec(readFileSync(new URL(file, migrations), 'utf8'));
  }
  const project = (await database.query('select version() as version')).rows[0].version;
  return { database, version: project };
}

// Simulates the SQL role/claims context supplied by a verified API gateway.
// Tests intentionally control it; application runtime must never accept raw claims.
export async function asRole(database, role, claims, operation) {
  if (!['anon', 'authenticated', 'service_role'].includes(role)) throw new Error('Unsupported test role');
  await database.exec('begin');
  try {
    await database.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    await database.exec(`set local role ${role}`);
    const result = await operation(database);
    await database.exec('commit');
    return result;
  } catch (error) {
    await database.exec('rollback');
    throw error;
  }
}
