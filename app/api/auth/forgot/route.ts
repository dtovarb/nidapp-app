import { createHash, randomBytes } from 'crypto';
import { requireDb } from '@/lib/db';
import { fail, json, HttpError } from '@/lib/api';
import { emailEnabled, sendEmail } from '@/lib/email';
import { isEmail, normEmail } from '@/lib/homes';

// Manda un link para elegir una contraseña nueva. Siempre responde lo mismo, exista o no la cuenta,
// para no revelar qué emails están registrados.
export async function POST(req:Request){try{
  const email=normEmail((await req.json()).email);
  if(!isEmail(email))throw new HttpError(400,'Escribí un email válido.');
  if(!emailEnabled())throw new HttpError(503,'La recuperación por email todavía no está activada. Pedile al dueño de tu residencia que te ponga una contraseña nueva.');
  const db=requireDb();
  const {data:acc}=await db.from('accounts').select('id,name').eq('email',email).maybeSingle();
  if(acc){
    const since=new Date(Date.now()-60*60*1000).toISOString();
    const {count}=await db.from('password_resets').select('id',{count:'exact',head:true}).eq('account_id',acc.id).gte('created_at',since);
    if((count||0)<3){
      const token=randomBytes(32).toString('base64url');
      await db.from('password_resets').insert({account_id:acc.id,token_hash:createHash('sha256').update(token).digest('hex'),expires_at:new Date(Date.now()+60*60*1000).toISOString()});
      const link=`${new URL(req.url).origin}/restablecer?token=${token}`;
      await sendEmail({to:email,subject:'Elegí una contraseña nueva · NIDAPP',text:`Hola ${acc.name}:\n\nPara elegir una contraseña nueva entrá a este link (vale por 1 hora):\n${link}\n\nSi no lo pediste, ignorá este email.`,html:`<p>Hola ${acc.name.replace(/</g,'&lt;')}:</p><p>Para elegir una contraseña nueva tocá el botón (el link vale por 1 hora):</p><p><a href="${link}" style="background:#9b5de5;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:bold">Elegir contraseña nueva</a></p><p style="color:#777">Si no lo pediste, ignorá este email.</p>`});
    }
  }
  return json({ok:true,message:'Si ese email tiene una cuenta, te mandamos un link para elegir una contraseña nueva.'});
}catch(e){return fail(e)}}
