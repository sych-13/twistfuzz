import { isPublicSupabaseKey } from './authConfiguration.ts';

// Refusing a private key only in browser code would be too late: VITE_* values
// could already have been emitted. Vite calls this before generating client code.
export function assertPublicEnvironment(environment: Record<string, unknown>): void {
  for (const [name, value] of Object.entries(environment)) {
    if (!name.startsWith('VITE_') || typeof value !== 'string' || !value.trim()) continue;
    if (/PRIVATE_KEY|SERVICE_ROLE|SERVICE_ACCOUNT|SECRET/i.test(name) || /-----BEGIN [\w ]*PRIVATE KEY-----/.test(value)) {
      throw new Error(`Refusing private credentials in public build variable ${name}. Use server-only configuration.`);
    }
  }
  const key = environment.VITE_SUPABASE_ANON_KEY;
  if (typeof key === 'string' && key.trim() && !isPublicSupabaseKey(key)) {
    throw new Error('VITE_SUPABASE_ANON_KEY must contain a Supabase publishable or legacy anon key. Private keys cannot be included in a browser build.');
  }
}
