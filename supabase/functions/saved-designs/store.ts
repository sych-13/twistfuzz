import type { SupabaseClient } from '@supabase/supabase-js';
import { AccessError } from '../_shared/auth.ts';
import { DESIGN_PAGE_SIZE } from '../../../src/features/studio/savedDesigns.ts';
import type { DesignCommand } from '../../../src/features/studio/savedDesigns.ts';

const columns = 'id,name,configuration,revision,created_at,updated_at';
const unavailable = () => new AccessError(503, 'design_service_unavailable', 'Saved designs are temporarily unavailable.');
export async function executeDesignCommand(database: SupabaseClient, uid: string, command: DesignCommand): Promise<unknown> {
  if (command.action === 'list') {
    const { data, error } = await database.from('custom_designs').select(columns).eq('owner_uid', uid)
      .order('created_at', { ascending: false }).order('id', { ascending: false })
      .range(command.offset, command.offset + DESIGN_PAGE_SIZE);
    if (error || !data) throw unavailable();
    return { designs: data.slice(0, DESIGN_PAGE_SIZE), hasMore: data.length > DESIGN_PAGE_SIZE };
  }
  if (command.action === 'get') {
    const { data, error } = await database.from('custom_designs').select(columns).eq('owner_uid', uid).eq('id', command.id).maybeSingle();
    if (error) throw unavailable();
    if (!data) throw new AccessError(404, 'design_unavailable', 'This saved design is unavailable.');
    return { design: data };
  }
  if (command.action === 'create') {
    const { data, error } = await database.from('custom_designs').insert({ owner_uid: uid, name: command.name, configuration: command.configuration }).select(columns).single();
    if (error || !data) throw unavailable();
    return { design: data };
  }
  const query = command.action === 'delete' ? database.from('custom_designs').delete() :
    database.from('custom_designs').update({ name: command.name, configuration: command.configuration });
  const { data, error } = await query.eq('owner_uid', uid).eq('id', command.id).eq('revision', command.revision)
    .select(command.action === 'delete' ? 'id' : columns).maybeSingle();
  if (error) throw unavailable();
  // Same outcome for a stale revision, absent record or another owner's record.
  if (!data) throw new AccessError(409, 'design_conflict', 'The design changed or is unavailable. Refresh your saved designs before trying again.');
  return command.action === 'delete' ? { deleted: true } : { design: data };
}
