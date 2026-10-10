import { requireDb } from '@/lib/db';
import { setSession } from '@/lib/auth';
import { fail, json, HttpError } from '@/lib/api';
import { createHome, findOrCreateAccount, isEmail, joinWithInvite, normEmail } from '@/lib/homes';

const MAX_SIGNUPS=5, WINDOW_MIN=60;

// Registro: un dueño crea su cuenta y su primera residencia, o una persona se une con un código de invitación.
// Si el email ya tiene cuenta y la contraseña coincide, se agrega la residencia a esa misma cuenta.
export async function POST(req:Request){try{
  const b=await req.json();const db=requireDb();
  const name=String(b.name||'').trim().slice(0,60),email=normEmail(b.email),password=String(b.password||'');
  if(!name)throw new HttpError(400,'Escribí tu nombre.');
  if(!isEmail(email))throw new HttpError(400,'Escribí un email válido.');
  if(password.length<8)throw new HttpError(400,'La contraseña debe tener al menos 8 caracteres.');
  if(b.mode!=='owner'&&b.mode!=='join')throw new HttpError(400,'Elegí cómo querés usar NIDAPP.');
  const key=`signup:${email}`;const since=new Date(Date.now()-WINDOW_MIN*60*1000).toISOString();
  const {count}=await db.from('login_attempts').select('id',{count:'exact',head:true}).eq('username',key).gte('attempted_at',since);
  if((count||0)>=MAX_SIGNUPS)throw new HttpError(429,'Demasiados intentos. Probá de nuevo en una hora.');
  await db.from('login_attempts').insert({username:key});
  const account=await findOrCreateAccount(db,{name,email,password});
  let memberId:string;
  if(b.mode==='owner'){memberId=(await createHome(db,account.id,{homeName:String(b.homeName||''),ownerName:name,email,rooms:b.rooms,price:b.price})).memberId;}
  else{if(!String(b.code||'').trim())throw new HttpError(400,'Escribí el código de invitación.');memberId=(await joinWithInvite(db,account.id,String(b.code),name,email)).memberId;}
  await db.from('accounts').update({last_member_id:memberId}).eq('id',account.id);
  await setSession(memberId,account.id);
  return json({ok:true});
}catch(e){return fail(e)}}
