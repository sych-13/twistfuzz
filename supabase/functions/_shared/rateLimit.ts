import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthDependencies } from './auth.ts';

// Uses a service-only RPC. The database owns time, capacity, keys and atomic
// increments. No in-memory fallback, caller-selected limits, or automatic retry.
export function createRateLimitConsumer(database: SupabaseClient, projectId: string): AuthDependencies['consumeRateLimit'] {
  return async (scope, uid) => {
    const { data, error } = await database.rpc('consume_request_allowance', {
      p_project_id: projectId, p_scope: scope, p_uid: uid ?? null,
    }).abortSignal(AbortSignal.timeout(3000)).single();
    if (error) throw new Error('Request allowance unavailable');
    return data;
  };
}
