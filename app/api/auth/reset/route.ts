import { createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import { requireDb } from '@/lib/db';
import { fail, json, HttpError } from '@/lib/api';

export async function POST(req:Request){try{
  const b=await req.json();const password=String(b.password||'');
  if(password.length<8)throw new HttpError(400,'La contraseña debe tener al menos 8 caracteres.');
  const db=requireDb();
  const {data:r}=await db.from('password_resets').select('id,account_id,expires_at,used').eq('token_hash',createHash('sha256').update(String(b.token||'')).digest('hex')).maybeSingle();
  if(!r||r.used||new Date(r.expires_at)<new Date())throw new HttpError(400,'El link venció o ya se usó. Pedí uno nuevo.');
  const {error}=await db.from('accounts').update({password_hash:await bcrypt.hash(password,10)}).eq('id',r.account_id);if(error)throw error;
  await db.from('password_resets').update({used:true}).eq('account_id',r.account_id);
  return json({ok:true});
}catch(e){return fail(e)}}
