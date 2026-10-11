import { homeContext, fail, json, HttpError } from '@/lib/api';
import { sendEmail, adminEmailEnabled, escapeHtml } from '@/lib/email';
import { LEGAL } from '@/app/legal';
const kinds=['idea','bug','like','other'];
const kindLabel:Record<string,string>={idea:'Idea',bug:'Algo no anda',like:'Me gusta',other:'Otro'};
// Comentarios de la etapa de prueba: se guardan en la tabla feedback y, si hay email configurado, llegan al contacto de NIDAPP.
export async function POST(req:Request){try{const {s,db,homeId}=await homeContext();const b=await req.json();const message=String(b.message||'').trim().slice(0,2000);if(message.length<3)throw new HttpError(400,'Escribí tu comentario.');const kind=kinds.includes(b.kind)?b.kind:'other';const rating=Number.isInteger(b.rating)&&b.rating>=1&&b.rating<=5?b.rating:null;
const since=new Date(Date.now()-864e5).toISOString();const {count}=await db.from('feedback').select('id',{count:'exact',head:true}).eq('user_id',s.id).gte('created_at',since);if((count||0)>=10)throw new HttpError(429,'Ya mandaste muchos comentarios hoy. ¡Gracias! Probá de nuevo mañana.');
const {error}=await db.from('feedback').insert({home_id:homeId,user_id:s.id,role:s.role,kind,rating,message,device:b.device==='mobile'?'mobile':'desktop'});if(error)throw error;
if(adminEmailEnabled())await sendEmail({admin:true,to:process.env.FEEDBACK_EMAIL||LEGAL.contact,subject:`NIDAPP · ${kindLabel[kind]}`,text:`${s.name} (${s.role}) · ${s.home_name||''}\n${rating?`Puntaje: ${rating}/5\n`:''}\n${message}`,html:`<p><b>${escapeHtml(s.name)}</b> (${s.role}) · ${escapeHtml(s.home_name||'')}</p>${rating?`<p>Puntaje: ${rating}/5</p>`:''}<p>${escapeHtml(message).replace(/\n/g,'<br>')}</p>`}).catch(()=>false);
return json({ok:true});}catch(e){return fail(e)}}
