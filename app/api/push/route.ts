import { getSession } from '@/lib/auth';
import { requireDb } from '@/lib/db';
import { fail, json, HttpError } from '@/lib/api';

// Guarda o borra la suscripción push de este dispositivo para la cuenta.
export async function POST(req:Request){try{
  const s=await getSession();if(!s)throw new HttpError(401,'No autenticado');
  const sub=(await req.json()).subscription;
  if(!sub?.endpoint||!sub?.keys?.p256dh||!sub?.keys?.auth||!String(sub.endpoint).startsWith('https://'))throw new HttpError(400,'Suscripción inválida.');
  const {error}=await requireDb().from('push_subscriptions').upsert({account_id:s.account_id,endpoint:sub.endpoint,p256dh:sub.keys.p256dh,auth:sub.keys.auth},{onConflict:'endpoint'});
  if(error)throw error;return json({ok:true});
}catch(e){return fail(e)}}
export async function DELETE(req:Request){try{
  const s=await getSession();if(!s)throw new HttpError(401,'No autenticado');
  const {endpoint}=await req.json();
  await requireDb().from('push_subscriptions').delete().eq('endpoint',String(endpoint||'')).eq('account_id',s.account_id);
  return json({ok:true});
}catch(e){return fail(e)}}
