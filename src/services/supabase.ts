import type {SupabaseClient} from '@supabase/supabase-js';
import {auth,authIntegrationReady} from './firebase';
import {authenticationConfiguration} from './authConfiguration';
const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabaseConfigured=authenticationConfiguration(import.meta.env).supabaseConfigured;
let client:Promise<SupabaseClient>|null=null;
export async function getSupabase():Promise<SupabaseClient|null>{
 if(!authIntegrationReady)return null;
 client??=import('@supabase/supabase-js').then(({createClient})=>createClient(url,key,{
  accessToken:async()=>auth?.currentUser ? auth.currentUser.getIdToken() : null,
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
 }));
 return client;
}
// Important: Supabase requests from Firebase users MUST use a verified Firebase ID token
// via an accepted JWT integration or trusted Edge Function. Never use service_role in a browser.
