import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const db = url && key ? createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }) : null;

export function requireDb() {
  if (!db) throw new Error('Supabase no está configurado. Copiá .env.example a .env.local y completá las variables.');
  return db;
}
