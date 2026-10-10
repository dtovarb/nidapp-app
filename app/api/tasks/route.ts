import { isManager } from '@/lib/auth';
import { homeContext, fail, json, HttpError, notifyUsers } from '@/lib/api';
import { todayAR } from '@/lib/rent';
import { ensureCurrent, loadTasks, monthView, notifyAssignee, periodOf, type Task } from '@/lib/tasks';

const FREQ=['weekly','monthly'], BY=['room','person'];

// Calendario de un mes (?month=AAAA-MM): asignaciones guardadas + vista previa de las semanas que vienen.
export async function GET(req:Request){try{const {db,homeId}=await homeContext();await ensureCurrent(db,homeId);const t=todayAR();const month=new URL(req.url).searchParams.get('month')||`${t.y}-${String(t.m).padStart(2,'0')}`;if(!/^\d{4}-\d{2}$/.test(month))throw new HttpError(400,'Mes inválido.');return json(await monthView(db,homeId,month));}catch(e){return fail(e)}}

export async function POST(req:Request){try{const {db,homeId}=await homeContext({ownerOnly:true});const b=await req.json();const name=String(b.name||'').trim();if(!name)throw new HttpError(400,'Escribí el nombre de la tarea.');const {count}=await db.from('tasks').select('id',{count:'exact',head:true}).eq('home_id',homeId);const {data,error}=await db.from('tasks').insert({home_id:homeId,name,position:count||0,frequency:FREQ.includes(b.frequency)?b.frequency:'weekly',assign_by:BY.includes(b.assign_by)?b.assign_by:'room'}).select().single();if(error)throw error;await ensureCurrent(db,homeId);return json({item:data});}catch(e){return fail(e)}}

// action 'done': marcar terminada (quien tiene asignada la tarea, o el dueño).
// action 'assign': el dueño elige a quién le toca un período (esta semana o una futura).
// action 'config': el dueño cambia nombre, frecuencia o forma de rotar una tarea.
export async function PATCH(req:Request){try{const {s,db,homeId}=await homeContext();const b=await req.json();
  if(b.action==='done'){
    const {data:a}=await db.from('task_assignments').select('id,room,member_id,task_id,done,tasks(name)').eq('id',b.id).eq('home_id',homeId).maybeSingle();if(!a)throw new HttpError(404,'Asignación no encontrada.');
    const mine=a.member_id?a.member_id===s.id:Boolean(a.room&&s.room===a.room);
    if(!isManager(s.role)&&!mine)throw new HttpError(403,'Solo quien tiene asignada la tarea puede marcarla.');
    const done=Boolean(b.done);const {data,error}=await db.from('task_assignments').update({done,done_at:done?new Date().toISOString():null}).eq('id',a.id).select().single();if(error)throw error;
    if(done&&!a.done){const {data:people}=await db.from('users').select('id').eq('home_id',homeId).eq('active',true).neq('id',s.id);await notifyUsers(db,homeId,(people||[]).map(p=>p.id),'✅ Tarea terminada',`${s.name}${s.room?` (Hab. ${s.room})`:''} terminó: ${(a as any).tasks?.name||'una tarea'}.`,'task');}
    return json({item:data});
  }
  if(!isManager(s.role))throw new HttpError(403,'Solo el dueño puede cambiar las tareas.');
  const tasks=await loadTasks(db,homeId);const task=tasks.find(t=>t.id===b.task_id);if(!task)throw new HttpError(404,'Tarea no encontrada.');
  if(b.action==='assign'){
    const {start,end}=periodOf(task,String(b.period_start||''));if(start!==b.period_start)throw new HttpError(400,'Período inválido.');
    if(end<periodOf(task,todayAR().iso).start)throw new HttpError(400,'No se pueden cambiar semanas que ya pasaron.');
    let room:string|null=null,member_id:string|null=null;
    if(task.assign_by==='person'){const {data:m}=await db.from('users').select('id,room').eq('id',b.member_id).eq('home_id',homeId).eq('role','resident').eq('active',true).maybeSingle();if(!m)throw new HttpError(400,'Elegí un habitante.');if(task.bathroom_id){const {data:inBath}=await db.from('bathroom_members').select('member_id').eq('bathroom_id',task.bathroom_id).eq('member_id',m.id).maybeSingle();if(!inBath)throw new HttpError(400,'Esa persona no usa este baño. Agregala al baño primero.');}member_id=m.id;room=m.room;}
    else{const {data:r}=await db.from('rooms').select('number').eq('home_id',homeId).eq('number',String(b.room||'')).maybeSingle();if(!r)throw new HttpError(400,'Esa habitación no existe.');room=r.number;}
    const {data,error}=await db.from('task_assignments').upsert({home_id:homeId,task_id:task.id,period_start:start,period_end:end,room,member_id,done:false,done_at:null},{onConflict:'task_id,period_start'}).select().single();if(error)throw error;
    await notifyAssignee(db,homeId,task,{room,member_id,start,end});
    return json({item:data});
  }
  if(b.action==='config'){
    const changes:Partial<Task>={};if(b.name!==undefined){const n=String(b.name).trim();if(!n)throw new HttpError(400,'El nombre no puede quedar vacío.');changes.name=n;}
    if(FREQ.includes(b.frequency))changes.frequency=b.frequency;if(BY.includes(b.assign_by)&&!task.bathroom_id)changes.assign_by=b.assign_by;
    const {error}=await db.from('tasks').update(changes).eq('id',task.id);if(error)throw error;
    // Si cambió cómo rota, se rehacen las asignaciones pendientes desde el período actual.
    if((changes.frequency&&changes.frequency!==task.frequency)||(changes.assign_by&&changes.assign_by!==task.assign_by)){
      const from=periodOf(task,todayAR().iso).start;
      const {error:delErr}=await db.from('task_assignments').delete().eq('task_id',task.id).eq('done',false).gte('period_start',from);if(delErr)throw delErr;
      await ensureCurrent(db,homeId);
    }
    return json({ok:true});
  }
  throw new HttpError(400,'Acción inválida.');
}catch(e){return fail(e)}}

export async function DELETE(req:Request){try{const {db,homeId}=await homeContext({ownerOnly:true});const b=await req.json();const {error}=await db.from('tasks').delete().eq('id',b.id).eq('home_id',homeId);if(error)throw error;return json({ok:true});}catch(e){return fail(e)}}
