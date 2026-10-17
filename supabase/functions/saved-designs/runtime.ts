import { createClient } from '@supabase/supabase-js';
import { createDependencies } from '../_shared/runtime.ts';
import type { Environment } from '../_shared/runtime.ts';
import { AccessError } from '../_shared/auth.ts';
import { isPublicSupabaseKey } from '../../../src/services/authConfiguration.ts';
import { executeDesignCommand } from './store.ts';
import type { SavedDesignDependencies } from './handler.ts';

export function createSavedDesignDependencies(environment: Environment): () => SavedDesignDependencies {
  const auth = createDependencies(environment);
  return () => {
    const verifiedAuth = auth(); // Disabled configuration must not initialize a user client.
    const url = environment.get('SUPABASE_URL');
    const key = environment.get('SUPABASE_PUBLISHABLE_KEY') ?? environment.get('SUPABASE_ANON_KEY');
    if (!url || !isPublicSupabaseKey(key)) throw new AccessError(503, 'design_setup_pending', 'Saved-design integration is pending validation.');
    return { auth: verifiedAuth, execute: (uid, token, command) => {
      // A fresh request-scoped client carries this verified user's token, not service_role.
      const database = createClient(url, key, { accessToken: async () => token,
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
      return executeDesignCommand(database, uid, command);
    } };
  };
}
