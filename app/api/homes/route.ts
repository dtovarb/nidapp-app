import { getSession, setSession } from '@/lib/auth';
import { requireDb } from '@/lib/db';
import { fail, json, HttpError } from '@/lib/api';
import { createHome, joinWithInvite } from '@/lib/homes';

async function account(){const s=await getSession();if(!s)throw new HttpError(401,'No autenticado');return s;}

// Las residencias de la cuenta, con la cantidad de notificaciones sin leer en cada una.
export async function GET(){try{const s=await account();const db=requireDb();const {data,error}=await db.from('users').select('id,role,room,home_id,homes(name)').eq('account_id',s.account_id).eq('active',true).order('created_at');if(error)throw error;const ids=(data||[]).map(m=>m.id);const {data:unread}=ids.length?await db.from('notifications').select('user_id').in('user_id',ids).eq('read',false):{data:[]};const count=new Map<string,number>();for(const n of unread||[])count.set(n.user_id,(count.get(n.user_id)||0)+1);return json({current:s.id,items:(data||[]).map((m:any)=>({member_id:m.id,home_id:m.home_id,name:m.homes?.name||'Residencia',role:m.role,room:m.room,unread:count.get(m.id)||0}))});}catch(e){return fail(e)}}

// {action:'create', homeName, rooms, price} crea una residencia nueva como dueño.
// {action:'join', code} se une con un código. {action:'switch', member_id} cambia de residencia.
export async function POST(req:Request){try{const s=await account();const db=requireDb();const b=await req.json();let memberId:string;
  const {data:acc}=await db.from('accounts').select('email,name').eq('id',s.account_id).single();
  if(b.action==='create'){memberId=(await createHome(db,s.account_id,{homeName:String(b.homeName||''),ownerName:s.name,email:acc?.email||null,rooms:b.rooms,price:b.price})).memberId;}
  else if(b.action==='join'){if(!String(b.code||'').trim())throw new HttpError(400,'Escribí el código de invitación.');memberId=(await joinWithInvite(db,s.account_id,String(b.code),s.name,acc?.email||null)).memberId;}
  else if(b.action==='switch'){const {data:m}=await db.from('users').select('id').eq('id',b.member_id).eq('account_id',s.account_id).eq('active',true).maybeSingle();if(!m)throw new HttpError(404,'Residencia no encontrada.');memberId=m.id;}
  else throw new HttpError(400,'Acción inválida.');
  await db.from('accounts').update({last_member_id:memberId}).eq('id',s.account_id);await setSession(memberId,s.account_id);return json({ok:true});
}catch(e){return fail(e)}}
