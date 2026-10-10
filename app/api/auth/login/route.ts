import bcrypt from 'bcryptjs';
import { requireDb } from '@/lib/db';
import { setSession } from '@/lib/auth';
import { fail, json, HttpError } from '@/lib/api';

const MAX_FAILS=5, WINDOW_MIN=15;

// Entra con email (cuentas nuevas) o con nombre de usuario (cuentas creadas antes de la v4).
async function findAccount(db:ReturnType<typeof requireDb>, id:string){
  if(id.includes('@')){const {data}=await db.from('accounts').select('id,password_hash,last_member_id').eq('email',id).maybeSingle();return data;}
  const {data:m}=await db.from('users').select('account_id').eq('username',id).maybeSingle();
  if(!m?.account_id)return null;
  const {data}=await db.from('accounts').select('id,password_hash,last_member_id').eq('id',m.account_id).maybeSingle();return data;
}

export async function POST(req: Request){
 try{const b=await req.json();const id=String(b.email||b.username||'').trim().toLowerCase();const password=String(b.password||'');if(!id||!password)throw new HttpError(400,'Completá email y contraseña.');const db=requireDb();const since=new Date(Date.now()-WINDOW_MIN*60*1000).toISOString();const {count}=await db.from('login_attempts').select('id',{count:'exact',head:true}).eq('username',id).gte('attempted_at',since);if((count||0)>=MAX_FAILS)throw new HttpError(429,`Demasiados intentos. Probá de nuevo en ${WINDOW_MIN} minutos.`);const acc=await findAccount(db,id);if(!acc||!(await bcrypt.compare(password,acc.password_hash))){await db.from('login_attempts').insert({username:id});throw new HttpError(401,'Email o contraseña incorrectos.');}await db.from('login_attempts').delete().eq('username',id);
 // Entra a la última residencia que usó; si ya no está activa, a la primera activa.
 const {data:members}=await db.from('users').select('id').eq('account_id',acc.id).eq('active',true).order('created_at');if(!members?.length)throw new HttpError(403,'Tu cuenta no está activa en ninguna residencia. Pedile al dueño un código de invitación y usalo en "Crear cuenta → Tengo un código".');const member=members.find(m=>m.id===acc.last_member_id)||members[0];await setSession(member.id,acc.id);return json({ok:true});}catch(e){return fail(e)}
}
