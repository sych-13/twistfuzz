import type { User } from 'firebase/auth';
import { auth } from './firebase';
import { getSupabase } from './supabase';
import { DesignServiceError, parseDesignCommand, parseDesignResult } from '../features/studio/savedDesigns';
import type { DesignCommand, DesignResult } from '../features/studio/savedDesigns';

export async function requestSavedDesigns(user: User, input: DesignCommand): Promise<DesignResult> {
  let command: DesignCommand;
  try { command = parseDesignCommand(input); } catch { throw new DesignServiceError(400); }
  const current = () => { if (!auth || auth.currentUser !== user || !user.emailVerified) throw new DesignServiceError(401); };
  current();
  const database = await getSupabase();
  if (!database) throw new DesignServiceError(503);
  const token = await user.getIdToken();
  current();
  const { data, error } = await database.functions.invoke('saved-designs', { headers: { Authorization: `Bearer ${token}` }, body: command });
  current();
  if (error) throw new DesignServiceError(error.context instanceof Response ? error.context.status : 503);
  try { return parseDesignResult(data, command); } catch { throw new DesignServiceError(503); }
}
