import type {User} from 'firebase/auth';
import {getSupabase} from './supabase';
export type Role = 'customer'|'staff'|'admin';
export async function resolveRole(user:User):Promise<Role>{
 const supabase=await getSupabase();
 if(!supabase) throw new Error('Supabase configuration is missing.');
 const token=await user.getIdToken();
 const {data,error}=await supabase.functions.invoke('resolve-role',{
   headers:{Authorization:`Bearer ${token}`},body:{}
 });
 if(error) throw new Error('Role service unavailable or identity not verified.');
 if(!data || !['customer','staff','admin'].includes(data.role)) throw new Error('Account has no assigned role.');
 return data.role as Role;
}
// The function MUST verify the Firebase JWT server-side AND fetch a trusted role in Supabase.
// Hiding pages on the client alone is not sufficient authorization.
