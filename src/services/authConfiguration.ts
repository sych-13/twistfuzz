type Environment = Record<string, unknown>;
const present = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export function isPublicSupabaseKey(value: unknown): value is string {
  if (!present(value) || value.startsWith('sb_secret_')) return false;
  if (value.startsWith('sb_publishable_')) return true;
  try {
    const parts = value.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload?.role === 'anon';
  } catch { return false; }
}

export function authenticationConfiguration(environment: Environment) {
  const firebaseConfigured = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID'].every(key => present(environment[key]));
  let supabaseConfigured = false;
  try {
    const url = new URL(String(environment.VITE_SUPABASE_URL ?? ''));
    const secureUrl = url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname));
    supabaseConfigured = secureUrl && isPublicSupabaseKey(environment.VITE_SUPABASE_ANON_KEY);
  } catch { /* An incomplete public configuration is an unavailable service. */ }
  // This flag only controls frontend availability. Every request still requires backend authorization.
  const integrationReady = environment.VITE_AUTH_INTEGRATION_READY === 'true';
  return { firebaseConfigured, supabaseConfigured, integrationReady, ready: firebaseConfigured && supabaseConfigured && integrationReady };
}
