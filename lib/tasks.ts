import type { requireDb } from '@/lib/db';
import { monthKey } from '@/lib/rent';

type Db = ReturnType<typeof requireDb>;
const byNumber=(a:string,b:string)=>a.localeCompare(b,'es',{numeric:true});

// Crea las asignaciones del mes que falten, rotando las tareas entre las habitaciones ocupadas.
// Una vez creadas quedan guardadas, así el dueño puede corregirlas a mano y el historial no cambia.
export async function ensureAssignments(db:Db, homeId:string, y:number, m:number){
  const month=monthKey(y,m);
  const [{data:tasks,error:e1},{data:residents,error:e2},{data:existing,error:e3}]=await Promise.all([
    db.from('tasks').select('id,name,position').eq('home_id',homeId).order('position').order('created_at'),
    db.from('users').select('id,room').eq('home_id',homeId).eq('role','resident').eq('active',true),
    db.from('task_assignments').select('task_id').eq('home_id',homeId).eq('month',month),
  ]);
  if(e1||e2||e3) throw (e1||e2||e3);
  const occupied=[...new Set((residents||[]).map(r=>r.room).filter(Boolean) as string[])].sort(byNumber);
  if(!occupied.length) return;
  const done=new Set((existing||[]).map(a=>a.task_id));
  const offset=y*12+(m-1);
  const rows=(tasks||[]).map((t,i)=>({task:t,room:occupied[(i+offset)%occupied.length]})).filter(x=>!done.has(x.task.id));
  if(!rows.length) return;
  const {data:inserted,error}=await db.from('task_assignments').upsert(rows.map(x=>({home_id:homeId,task_id:x.task.id,month,room:x.room})),{onConflict:'task_id,month',ignoreDuplicates:true}).select('task_id,room');
  if(error) throw error;
  const names=new Map((tasks||[]).map(t=>[t.id,t.name]));
  const notes=(inserted||[]).flatMap(a=>(residents||[]).filter(r=>r.room===a.room).map(r=>({home_id:homeId,user_id:r.id,title:'Tarea del mes',message:`Este mes a tu habitación le toca: ${names.get(a.task_id)}.`,kind:'task'})));
  if(notes.length){ const {error:ne}=await db.from('notifications').insert(notes); if(ne) throw ne; }
}
