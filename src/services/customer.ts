import type { User } from 'firebase/auth';
import { getSupabase } from './supabase';
import { finishCustomerSetup } from '../features/auth/customerSetup';

export async function ensureCustomerAccount(user: User): Promise<void> {
  const database = await getSupabase();
  if (!database) throw new Error('Customer account service is unavailable.');
  const token = await user.getIdToken();
  const { data, error } = await database.functions.invoke('provision-customer', { headers: { Authorization: `Bearer ${token}` }, body: {} });
  if (error) throw new Error('Customer account setup could not be verified.');
  // Only the server changes claims. Fetch the new fixed transport claim before
  // ordinary role/data requests; this does not grant a TWISTFUZZ business role.
  await finishCustomerSetup(data, async () => (await user.getIdTokenResult(true)).claims);
}
