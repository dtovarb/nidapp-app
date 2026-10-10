import bcrypt from 'bcryptjs';
import { getSession, clearSession } from '@/lib/auth';
import { requireDb } from '@/lib/db';
import { fail, json, HttpError } from '@/lib/api';

// Elimina la cuenta y todos sus datos (lo exigen las tiendas de aplicaciones).
// No deja huérfana una residencia con otras personas: el dueño primero tiene que sumar
// otro dueño/encargado o desactivar a los habitantes.
export async function DELETE(req:Request){try{
  const s=await getSession();if(!s)throw new HttpError(401,'No autenticado');
  const db=requireDb();const b=await req.json();
  const {data:acc}=await db.from('accounts').select('id,password_hash').eq('id',s.account_id).single();
  if(!acc||!(await bcrypt.compare(String(b.password||''),acc.password_hash)))throw new HttpError(400,'La contraseña no es correcta.');
  const {data:owned}=await db.from('users').select('home_id,homes(name)').eq('account_id',acc.id).eq('role','owner').eq('active',true);
  const emptyHomes:string[]=[];
  for(const o of (owned||[]) as any[]){
    const {count:others}=await db.from('users').select('id',{count:'exact',head:true}).eq('home_id',o.home_id).eq('active',true).neq('account_id',acc.id);
    if(!others){emptyHomes.push(o.home_id);continue;}
    const {count:managers}=await db.from('users').select('id',{count:'exact',head:true}).eq('home_id',o.home_id).eq('active',true).in('role',['owner','admin']).neq('account_id',acc.id);
    if(!managers)throw new HttpError(400,`"${o.homes?.name}" tiene habitantes. Antes de eliminar tu cuenta, invitá a otra persona como encargada o desactivá a los habitantes.`);
    // Si no queda otro dueño, el encargado más antiguo pasa a ser dueño.
    const {count:owners}=await db.from('users').select('id',{count:'exact',head:true}).eq('home_id',o.home_id).eq('active',true).eq('role','owner').neq('account_id',acc.id);
    if(!owners){const {data:next}=await db.from('users').select('id').eq('home_id',o.home_id).eq('active',true).eq('role','admin').order('created_at').limit(1).single();if(next)await db.from('users').update({role:'owner'}).eq('id',next.id);}
  }
  if(emptyHomes.length){const {error}=await db.from('homes').delete().in('id',emptyHomes);if(error)throw error;}
  // En las residencias que siguen funcionando se conserva el historial (pagos, reservas), pero sin datos personales.
  const {error:anonError}=await db.from('users').update({account_id:null,active:false,name:'Ex habitante',email:null,phone:null,emergency_phone:null,photo_path:null,presence_location:null,password_hash:null}).eq('account_id',acc.id);if(anonError)throw anonError;
  const {error}=await db.from('accounts').delete().eq('id',acc.id);if(error)throw error;
  await clearSession();
  return json({ok:true});
}catch(e){return fail(e)}}
