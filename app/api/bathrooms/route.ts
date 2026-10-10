import { homeContext, fail, json, HttpError } from '@/lib/api';
import { todayAR } from '@/lib/rent';
import { ensureCurrent, mondayOf } from '@/lib/tasks';

// Baños de la residencia y quiénes los usan. Cada baño tiene su tarea semanal de limpieza,
// que rota solo entre sus habitantes. Todos los ven; solo el dueño o un encargado los modifica.
const owner={ownerOnly:true,ownerMessage:'Solo el dueño puede configurar los baños.'};

async function validMembers(db:any,homeId:string,ids:unknown):Promise<string[]>{
  const list=[...new Set(Array.isArray(ids)?ids.map(String):[])];
  if(!list.length)return [];
  const {data}=await db.from('users').select('id').eq('home_id',homeId).eq('role','resident').in('id',list);
  return (data||[]).map((u:any)=>u.id as string);
}
// Al cambiar quién usa el baño, se rearman las semanas pendientes desde la actual.
async function resetPending(db:any,homeId:string,bathroomId:string){
  const {data:task}=await db.from('tasks').select('id').eq('bathroom_id',bathroomId).maybeSingle();
  if(task)await db.from('task_assignments').delete().eq('task_id',task.id).eq('done',false).gte('period_start',mondayOf(todayAR().iso));
  await ensureCurrent(db,homeId);
}

export async function GET(){try{const {db,homeId}=await homeContext();const {data,error}=await db.from('bathrooms').select('id,name,bathroom_members(member_id)').eq('home_id',homeId).order('created_at');if(error)throw error;return json({items:(data||[]).map((b:any)=>({id:b.id,name:b.name,member_ids:(b.bathroom_members||[]).map((m:any)=>m.member_id)}))});}catch(e){return fail(e)}}

export async function POST(req:Request){try{const {db,homeId}=await homeContext(owner);const b=await req.json();const name=String(b.name||'').trim().slice(0,40);if(!name)throw new HttpError(400,'Poné un nombre, por ejemplo "Baño varones".');
  const {data:bath,error}=await db.from('bathrooms').insert({home_id:homeId,name}).select('id').single();if(error)throw error;
  const members=await validMembers(db,homeId,b.member_ids);
  if(members.length){const {error:mErr}=await db.from('bathroom_members').insert(members.map((member_id:string)=>({bathroom_id:bath.id,member_id})));if(mErr)throw mErr;}
  const {count}=await db.from('tasks').select('id',{count:'exact',head:true}).eq('home_id',homeId);
  const {error:tErr}=await db.from('tasks').insert({home_id:homeId,name:`Limpiar ${name}`,position:count||0,frequency:'weekly',assign_by:'person',bathroom_id:bath.id});if(tErr)throw tErr;
  await ensureCurrent(db,homeId);return json({ok:true});
}catch(e){return fail(e)}}

export async function PATCH(req:Request){try{const {db,homeId}=await homeContext(owner);const b=await req.json();
  const {data:bath}=await db.from('bathrooms').select('id,name').eq('id',b.id).eq('home_id',homeId).maybeSingle();if(!bath)throw new HttpError(404,'Baño no encontrado.');
  if(b.name!==undefined){const name=String(b.name).trim().slice(0,40);if(!name)throw new HttpError(400,'El nombre no puede quedar vacío.');await db.from('bathrooms').update({name}).eq('id',bath.id);await db.from('tasks').update({name:`Limpiar ${name}`}).eq('bathroom_id',bath.id);}
  if(b.member_ids!==undefined){const members=await validMembers(db,homeId,b.member_ids);await db.from('bathroom_members').delete().eq('bathroom_id',bath.id);if(members.length){const {error}=await db.from('bathroom_members').insert(members.map((member_id:string)=>({bathroom_id:bath.id,member_id})));if(error)throw error;}await resetPending(db,homeId,bath.id);}
  return json({ok:true});
}catch(e){return fail(e)}}

export async function DELETE(req:Request){try{const {db,homeId}=await homeContext(owner);const b=await req.json();const {error}=await db.from('bathrooms').delete().eq('id',b.id).eq('home_id',homeId);if(error)throw error;return json({ok:true});}catch(e){return fail(e)}}
