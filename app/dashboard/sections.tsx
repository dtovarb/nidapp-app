'use client';
import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { SessionUser } from '@/lib/auth';

export type Room={id:string;number:string;capacity:number;occupants:number;price?:number};
type Api=(url:string,options?:RequestInit)=>Promise<any>;
type Props={api:Api;show:(s:string)=>void;session:SessionUser};

export function money(n:number){return '$'+Number(n||0).toLocaleString('es-AR',{minimumFractionDigits:0,maximumFractionDigits:2});}
export function dateAR(s:string){return new Date(s+'T12:00:00').toLocaleDateString('es-AR');}
export function monthLabel(key:string){const [y,m]=key.split('-').map(Number);return new Date(y,m-1,1).toLocaleDateString('es-AR',{month:'long',year:'numeric'});}
export const jsonBody=(method:string,body:unknown):RequestInit=>({method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const errMsg=(e:unknown)=>e instanceof Error?e.message:'Error';
const thisMonth=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;};

// ---------- Habitaciones: cantidad, cupo y precio (dueño) ----------
export function RoomsEditor({api,show,rooms,onChange}:Props&{rooms:Room[];onChange:()=>Promise<void>}){
 const [draft,setDraft]=useState<Record<string,{capacity:string;price:string}>>({});
 useEffect(()=>{setDraft(Object.fromEntries(rooms.map(r=>[r.id,{capacity:String(r.capacity),price:String(r.price??0)}])))},[rooms]);
 async function save(r:Room){const d=draft[r.id];try{await api('/api/rooms',jsonBody('PATCH',{id:r.id,capacity:Number(d.capacity),price:Number(d.price)}));show(`Habitación ${r.number} actualizada ✅`);await onChange()}catch(e){show(errMsg(e))}}
 async function add(){try{const j=await api('/api/rooms',jsonBody('POST',{capacity:1,price:rooms[rooms.length-1]?.price||0}));show(`Habitación ${j.item.number} agregada 🛏️`);await onChange()}catch(e){show(errMsg(e))}}
 async function remove(r:Room){if(!confirm(`¿Quitar la habitación ${r.number}?`))return;try{await api('/api/rooms',jsonBody('DELETE',{id:r.id}));show('Habitación quitada');await onChange()}catch(e){show(errMsg(e))}}
 const totalCapacity=rooms.reduce((a,r)=>a+r.capacity,0),totalPeople=rooms.reduce((a,r)=>a+r.occupants,0);
 return <div className="card span-12"><h3 className="card-title"><span>🛏️ Habitaciones, cupos y precios</span><button className="button purple" onClick={add}>+ Agregar habitación</button></h3>
 <p className="mini muted">{rooms.length} habitaciones · {totalPeople} de {totalCapacity} lugares ocupados. El precio es por persona: cada habitante de la habitación paga ese monto, aunque la compartan.</p>
 <div className="table-wrap"><table className="table"><thead><tr><th>HAB.</th><th>OCUPACIÓN</th><th>CUPO</th><th>PRECIO POR PERSONA</th><th>TOTAL HABITACIÓN</th><th></th></tr></thead><tbody>{rooms.map(r=>{const d=draft[r.id]||{capacity:'1',price:'0'};const changed=d.capacity!==String(r.capacity)||d.price!==String(r.price??0);const roomTotal=Number(d.price||0)*r.occupants;return <tr key={r.id}><td className="cell-head"><b>Habitación {r.number}</b></td><td data-label="OCUPACIÓN"><span className={'status '+(r.occupants>=r.capacity?'pending':'paid')}>{r.occupants}/{r.capacity}</span></td><td data-label="CUPO"><input className="cell-input" type="number" min={1} max={10} aria-label={`Cupo habitación ${r.number}`} value={d.capacity} onChange={e=>setDraft({...draft,[r.id]:{...d,capacity:e.target.value}})}/></td><td data-label="PRECIO POR PERSONA"><input className="cell-input wide" type="number" min={0} step={1000} aria-label={`Precio habitación ${r.number}`} value={d.price} onChange={e=>setDraft({...draft,[r.id]:{...d,price:e.target.value}})}/></td><td data-label="TOTAL HABITACIÓN" className="muted">{r.occupants?`${money(roomTotal)} (${r.occupants} × ${money(Number(d.price||0))})`:'—'}</td><td className="cell-actions"><div className="row-actions">{changed&&<button className="button" onClick={()=>save(r)}>Guardar</button>}{r.occupants===0&&<button className="button red" onClick={()=>remove(r)} aria-label={`Quitar habitación ${r.number}`}>Quitar</button>}</div></td></tr>})}</tbody></table></div></div>;
}

// ---------- Servicios y otros cobros (dueño edita, todos ven) ----------
type Charge={id:string;name:string;amount:number;active:boolean};
export function ChargesEditor({api,show,onChange}:Props&{onChange:()=>Promise<void>}){
 const [items,setItems]=useState<Charge[]>([]);const [form,setForm]=useState({name:'',amount:''});
 async function load(){try{setItems((await api('/api/charges')).items||[])}catch(e){show(errMsg(e))}}
 useEffect(()=>{load()},[]);
 async function run(init:RequestInit,msg:string){try{await api('/api/charges',init);show(msg);await load();await onChange()}catch(e){show(errMsg(e))}}
 const total=items.filter(c=>c.active).reduce((a,c)=>a+c.amount,0);
 return <div className="card" style={{marginTop:12}}><h3 className="card-title"><span>🔌 Servicios y otros cobros</span><span className="tag yellow">{money(total)} por habitante / mes</span></h3>
 <p className="mini muted">Monto fijo que paga cada habitante además del alquiler. Los cambios se aplican a los pagos pendientes de este mes.</p>
 {items.map(c=><div className={'notice '+(c.active?'green':'')} key={c.id}><div className="notice-icon">{c.active?'🔌':'⏸️'}</div><div className="notice-main"><b>{c.name}</b><div className="mini">{money(c.amount)} por habitante{c.active?'':' · pausado'}</div></div><button className="button yellow" onClick={()=>run(jsonBody('PATCH',{id:c.id,active:!c.active}),c.active?'Cobro pausado':'Cobro activado')}>{c.active?'Pausar':'Activar'}</button><button className="button red" onClick={()=>confirm(`¿Eliminar "${c.name}"?`)&&run(jsonBody('DELETE',{id:c.id}),'Cobro eliminado')}>Eliminar</button></div>)}
 {!items.length&&<div className="empty">Todavía no cargaste servicios.</div>}
 <div className="form-row" style={{marginTop:10}}><div className="field"><label htmlFor="ch-name">SERVICIO</label><input id="ch-name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Ej. Luz, Gas, Internet"/></div><div className="field"><label htmlFor="ch-amount">MONTO POR HABITANTE</label><input id="ch-amount" type="number" min={0} inputMode="decimal" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></div></div>
 <button className="button purple" style={{marginTop:10}} onClick={async()=>{await run(jsonBody('POST',{name:form.name,amount:Number(form.amount)}),'Servicio agregado 🔌');setForm({name:'',amount:''})}}>AGREGAR COBRO</button></div>;
}

// ---------- Tareas: semanales o mensuales, por habitación o por habitante ----------
type TaskDef={id:string;name:string;frequency:'weekly'|'monthly';assign_by:'room'|'person'};
type TaskPeriod={id?:string;task_id:string;start:string;end:string;room:string|null;member_id:string|null;done:boolean;done_at:string|null;preview:boolean};
type TaskMonth={month:string;from:string;to:string;today:string;tasks:TaskDef[];people:{id:string;name:string;room:string|null}[];rooms:string[];periods:TaskPeriod[]};
const taskIcon=(name:string)=>/basura/i.test(name)?'🗑️':/baño/i.test(name)?'🚽':/cocina/i.test(name)?'🍳':/patio|jard/i.test(name)?'🌿':'🧹';
const isoAdd=(iso:string,n:number)=>new Date(Date.parse(iso+'T00:00:00Z')+n*864e5).toISOString().slice(0,10);
const dm=(iso:string)=>{const [,m,d]=iso.split('-');return `${Number(d)}/${Number(m)}`;};
const shiftMonthKey=(key:string,n:number)=>{const [y,m]=key.split('-').map(Number);const t=y*12+m-1+n;return `${Math.floor(t/12)}-${String(t%12+1).padStart(2,'0')}`;};
const freqLabel={weekly:'Semanal',monthly:'Mensual'},byLabel={room:'Por habitación',person:'Por habitante'};

export function TasksSection({api,show,session}:Props&{rooms:Room[]}){
 const [month,setMonth]=useState('');const [data,setData]=useState<TaskMonth|null>(null);
 const [newTask,setNewTask]=useState({name:'',frequency:'weekly',assign_by:'room'});
 async function load(m=month){try{const j:TaskMonth=await api('/api/tasks'+(m?`?month=${m}`:''));setData(j);if(!m)setMonth(j.month)}catch(e){show(errMsg(e))}}
 useEffect(()=>{load(month)},[month]);
 async function run(init:RequestInit,msg:string){try{await api('/api/tasks',init);show(msg);await load()}catch(e){show(errMsg(e))}}
 if(!data)return <div className="card empty">Cargando tareas...</div>;
 const isOwner=session.role!=='resident';
 const task=(id:string)=>data.tasks.find(t=>t.id===id);
 const person=(id:string|null)=>data.people.find(p=>p.id===id);
 const who=(p:TaskPeriod)=>p.member_id?(person(p.member_id)?.name||'Habitante'):p.room?`Hab. ${p.room}`:'Sin asignar';
 const shortWho=(p:TaskPeriod)=>p.member_id?(person(p.member_id)?.name||'?').split(' ')[0].slice(0,8):p.room?`H${p.room}`:'—';
 const mine=(p:TaskPeriod)=>p.member_id?p.member_id===session.id:Boolean(p.room&&session.role==='resident'&&p.room===session.room);
 const canMark=(p:TaskPeriod)=>Boolean(p.id)&&(isOwner||mine(p));
 const order=(a:TaskPeriod,b:TaskPeriod)=>data.tasks.findIndex(t=>t.id===a.task_id)-data.tasks.findIndex(t=>t.id===b.task_id);
 const current=data.periods.filter(p=>p.start<=data.today&&p.end>=data.today).sort(order);
 const toggle=(p:TaskPeriod)=>run(jsonBody('PATCH',{action:'done',id:p.id,done:!p.done}),p.done?'Tarea marcada como pendiente':'¡Tarea terminada! Ya les avisamos a todos ✅');
 const assign=(p:TaskPeriod,value:string)=>{const t=task(p.task_id)!;run(jsonBody('PATCH',{action:'assign',task_id:t.id,period_start:p.start,...(t.assign_by==='person'?{member_id:value}:{room:value})}),'Tarea reasignada y avisada');};
 const assignSelect=(p:TaskPeriod)=>{const t=task(p.task_id)!;return <select className="cell-input" aria-label={`A quién le toca ${t.name} desde el ${dm(p.start)}`} value={(t.assign_by==='person'?p.member_id:p.room)||''} onChange={e=>assign(p,e.target.value)}><option value="" disabled>Elegir...</option>{t.assign_by==='person'?data.people.map(x=><option key={x.id} value={x.id}>{x.name}{x.room?` · H${x.room}`:''}</option>):data.rooms.map(r=><option key={r} value={r}>Hab. {r}</option>)}</select>;};
 const days:string[]=[];for(let d=data.from;d<=data.to;d=isoAdd(d,1))days.push(d);
 const weeks=[...new Set(data.periods.filter(p=>task(p.task_id)?.frequency==='weekly').map(p=>p.start))].filter(s=>s>=data.from&&s<=data.to).sort();
 const monthly=data.periods.filter(p=>task(p.task_id)?.frequency==='monthly'&&p.start.slice(0,7)===data.month).sort(order);
 const myNow=current.filter(mine);
 return <div className="grid">
 {!isOwner&&<div className="card span-12"><h3 className="card-title">🙋 Te toca</h3>{myNow.length?myNow.map(p=>{const t=task(p.task_id)!;return <div className={'notice '+(p.done?'green':'yellow')} key={p.task_id+p.start}><div className="notice-icon">{p.done?'✅':taskIcon(t.name)}</div><div className="notice-main"><b>{t.name}</b><div className="mini">{t.frequency==='weekly'?`Esta semana: ${dm(p.start)} al ${dm(p.end)}`:'Todo este mes'}{p.done&&p.done_at?` · terminada el ${new Date(p.done_at).toLocaleDateString('es-AR')}`:''}</div></div>{canMark(p)&&<button className={'button '+(p.done?'yellow':'')} onClick={()=>toggle(p)}>{p.done?'Desmarcar':'✅ Marcar terminada'}</button>}</div>}):<div className="empty">Esta semana no tenés tareas asignadas. 🎉</div>}</div>}
 <div className="card span-12"><h3 className="card-title">📋 Ahora</h3>{current.length?<div className="task-cards">{current.map(p=>{const t=task(p.task_id)!;return <div key={p.task_id+p.start} className={'task-card '+(p.done?'done':'')}><div className="task-card-icon">{p.done?'✅':taskIcon(t.name)}</div><b>{t.name}</b><span className="mini muted">{t.frequency==='weekly'?`Semana ${dm(p.start)} al ${dm(p.end)}`:'Todo el mes'} · {byLabel[t.assign_by].toLowerCase()}</span>{isOwner?assignSelect(p):<span className={'room-chip '+(mine(p)?'mine':'')}>{who(p)}{mine(p)?' · vos':''}</span>}<span className={'status '+(p.done?'paid':'due')}>{p.done?`TERMINADA${p.done_at?' · '+dm(p.done_at.slice(0,10)):''}`:'PENDIENTE'}</span>{canMark(p)&&<button className={'button '+(p.done?'yellow':'')} onClick={()=>toggle(p)}>{p.done?'Desmarcar':'Marcar terminada'}</button>}</div>})}</div>:<div className="empty">No hay habitantes con habitación para asignar tareas.</div>}
 <p className="mini muted">Cuando alguien marca su tarea como terminada, les llega una notificación al dueño y al resto de la casa. Cada lunes se avisa a quien le toca.</p></div>
 <div className="card span-12"><div className="card-title"><span>🗓️ Calendario de tareas</span><div style={{display:'flex',gap:7,alignItems:'center'}}><button className="button blue" aria-label="Mes anterior" onClick={()=>setMonth(shiftMonthKey(data.month,-1))}>←</button><b className="cal-month">{monthLabel(data.month)}</b><button className="button blue" aria-label="Mes siguiente" onClick={()=>setMonth(shiftMonthKey(data.month,1))}>→</button></div></div>
 <div className="task-legend">{data.tasks.map(t=><span key={t.id} className="room-chip">{taskIcon(t.name)} {t.name} · {freqLabel[t.frequency].toLowerCase()}, {byLabel[t.assign_by].toLowerCase()}</span>)}{session.role==='resident'&&<span className="room-chip mine">Resaltado: lo tuyo</span>}</div>
 <div className="calendar"><div className="calendar-head">{['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(x=><b key={x}>{x}</b>)}</div><div className="calendar-grid">{days.map(d=>{const items=data.periods.filter(p=>p.start<=d&&p.end>=d).sort(order);const outside=d.slice(0,7)!==data.month;return <div key={d} className={'calendar-day task-day'+(outside?' outside':'')+(d===data.today?' today':'')}><b>{Number(d.slice(8))}</b>{items.map(p=><div key={p.task_id+p.start} className={'task-chip'+(mine(p)?' mine':'')+(p.done?' done':'')} title={`${task(p.task_id)?.name}: ${who(p)}${p.done?' (terminada)':''}`}>{taskIcon(task(p.task_id)?.name||'')}<span>{shortWho(p)}</span></div>)}</div>})}</div></div>
 <p className="mini muted">Las semanas que vienen son una vista previa de la rotación: se confirman cada lunes y se ajustan si cambian los habitantes.</p></div>
 <div className="card span-12"><h3 className="card-title">📆 Semana por semana</h3>{weeks.map(start=>{const items=data.periods.filter(p=>p.start===start&&task(p.task_id)?.frequency==='weekly').sort(order);const end=isoAdd(start,6);const isNow=start<=data.today&&end>=data.today;const past=end<data.today;return <div key={start} className={'week-row'+(isNow?' now':'')+(past?' past':'')}><div className="week-dates"><b>{dm(start)} al {dm(end)}</b>{isNow&&<span className="tag green">ESTA SEMANA</span>}</div><div className="week-items">{items.map(p=>{const t=task(p.task_id)!;return <div key={p.task_id} className="week-item"><span>{taskIcon(t.name)} {t.name}</span>{isOwner&&!past?assignSelect(p):<span className={'room-chip '+(mine(p)?'mine':'')}>{who(p)}{p.done?' ✅':''}</span>}</div>})}</div></div>})}
 {monthly.length>0&&<div className="week-row"><div className="week-dates"><b>Todo el mes</b></div><div className="week-items">{monthly.map(p=>{const t=task(p.task_id)!;return <div key={p.task_id} className="week-item"><span>{taskIcon(t.name)} {t.name}</span>{isOwner&&p.end>=data.today?assignSelect(p):<span className={'room-chip '+(mine(p)?'mine':'')}>{who(p)}{p.done?' ✅':''}</span>}</div>})}</div></div>}
 {!weeks.length&&!monthly.length&&<div className="empty">No hay tareas para mostrar en este mes.</div>}
 {isOwner&&<p className="mini muted">Podés cambiar a quién le toca cualquier semana de hoy en adelante: se le avisa por notificación.</p>}</div>
 {isOwner&&<div className="card span-12"><h3 className="card-title">⚙️ Configurar tareas</h3>{data.tasks.map(t=><div className="notice task-config" key={t.id}><div className="notice-icon">{taskIcon(t.name)}</div><div className="notice-main"><b>{t.name}</b><div className="task-config-row"><select className="cell-input" aria-label={`Frecuencia de ${t.name}`} value={t.frequency} onChange={e=>run(jsonBody('PATCH',{action:'config',task_id:t.id,frequency:e.target.value}),'Frecuencia actualizada')}><option value="weekly">Semanal</option><option value="monthly">Mensual</option></select><select className="cell-input" aria-label={`Cómo rota ${t.name}`} value={t.assign_by} onChange={e=>run(jsonBody('PATCH',{action:'config',task_id:t.id,assign_by:e.target.value}),'Rotación actualizada')}><option value="room">Por habitación</option><option value="person">Por habitante</option></select></div></div><button className="button red" onClick={()=>confirm(`¿Eliminar la tarea "${t.name}"?`)&&run(jsonBody('DELETE',{id:t.id}),'Tarea eliminada')}>Eliminar</button></div>)}
 <div className="form" style={{marginTop:10}}><div className="field"><label htmlFor="task-new">NUEVA TAREA</label><input id="task-new" value={newTask.name} onChange={e=>setNewTask({...newTask,name:e.target.value})} placeholder="Ej. Limpiar la cocina"/></div><div className="form-row"><div className="field"><label htmlFor="task-freq">FRECUENCIA</label><select id="task-freq" value={newTask.frequency} onChange={e=>setNewTask({...newTask,frequency:e.target.value})}><option value="weekly">Semanal</option><option value="monthly">Mensual</option></select></div><div className="field"><label htmlFor="task-by">ROTA</label><select id="task-by" value={newTask.assign_by} onChange={e=>setNewTask({...newTask,assign_by:e.target.value})}><option value="room">Por habitación</option><option value="person">Por habitante</option></select></div></div><button className="button purple" onClick={async()=>{await run(jsonBody('POST',newTask),'Tarea agregada');setNewTask({name:'',frequency:'weekly',assign_by:'room'})}}>AGREGAR TAREA</button></div>
 <p className="mini muted">Si cambiás la frecuencia o la forma de rotar, se rearman las asignaciones pendientes desde esta semana.</p></div>}
 </div>;
}

// ---------- Normas de convivencia (el dueño las edita) ----------
type Rule={id:string;icon:string;title:string;body:string};
type RuleDraft={icon:string;title:string;body:string};
export function RulesSection({api,show,session}:Props){
 const [items,setItems]=useState<Rule[]>([]);const [editing,setEditing]=useState<Rule|null>(null);const [form,setForm]=useState<RuleDraft>({icon:'📌',title:'',body:''});
 async function load(){try{setItems((await api('/api/rules')).items||[])}catch(e){show(errMsg(e))}}
 useEffect(()=>{load()},[]);
 async function run(init:RequestInit,msg:string){try{await api('/api/rules',init);show(msg);await load();return true}catch(e){show(errMsg(e));return false}}
 const isOwner=session.role!=='resident';
 const ruleForm=<T extends RuleDraft>(v:T,set:(x:T)=>void,prefix:string)=><div className="form"><div className="form-row rule-row"><div className="field"><label htmlFor={prefix+'-icon'}>ÍCONO</label><input id={prefix+'-icon'} value={v.icon} maxLength={8} onChange={e=>set({...v,icon:e.target.value})}/></div><div className="field"><label htmlFor={prefix+'-title'}>TÍTULO</label><input id={prefix+'-title'} value={v.title} onChange={e=>set({...v,title:e.target.value})} placeholder="Ej. Mascotas"/></div></div><div className="field"><label htmlFor={prefix+'-body'}>NORMA</label><textarea id={prefix+'-body'} value={v.body} onChange={e=>set({...v,body:e.target.value})}/></div></div>;
 return <div className="grid"><div className="card span-12"><h3 className="card-title">📜 Normas de convivencia</h3><div className="grid">{items.map(r=>editing?.id===r.id?<div className="card span-6" key={r.id} style={{background:'#f3ecff'}}>{ruleForm(editing,setEditing,'er')}<div className="row-actions" style={{marginTop:10}}><button className="button" onClick={async()=>{if(await run(jsonBody('PATCH',editing),'Norma actualizada ✅'))setEditing(null)}}>GUARDAR</button><button className="button red" onClick={()=>setEditing(null)}>CANCELAR</button></div></div>:<div className="card span-6" key={r.id}><h3>{r.icon} {r.title}</h3><p>{r.body}</p>{isOwner&&<div className="row-actions"><button className="button blue" onClick={()=>setEditing({...r})}>✏️ Modificar</button><button className="button red" onClick={()=>confirm(`¿Quitar la norma "${r.title}"?`)&&run(jsonBody('DELETE',{id:r.id}),'Norma quitada')}>🗑️ Quitar</button></div>}</div>)}</div>{!items.length&&<div className="empty">Todavía no hay normas cargadas.</div>}</div>
 {isOwner&&<div className="card span-12"><h3 className="card-title">➕ Agregar norma</h3>{ruleForm(form,setForm,'nr')}<button className="button purple" style={{marginTop:10}} onClick={async()=>{if(await run(jsonBody('POST',form),'Norma agregada 📜'))setForm({icon:'📌',title:'',body:''})}}>AGREGAR NORMA</button></div>}</div>;
}

// ---------- Invitados: la imagen solo la ve el dueño ----------
type Guest={id:string;resident_id:string;guest_name:string;visit_date:string;start_time:string;end_time:string;notes:string|null;has_photo:boolean;photo_url?:string|null;users?:{name:string;room:string|null}|null};
export function GuestsSection({api,show,session,upload}:Props&{upload:(f:File,kind:'guest')=>Promise<{path:string}>}){
 const today=new Date().toLocaleDateString('en-CA');
 const empty={guest_name:'',visit_date:today,start_time:'18:00',end_time:'22:00',notes:''};
 const [items,setItems]=useState<Guest[]>([]);const [form,setForm]=useState(empty);const [file,setFile]=useState<File|null>(null);const [busy,setBusy]=useState(false);const [fileKey,setFileKey]=useState(0);
 async function load(){try{setItems((await api('/api/guests')).items||[])}catch(e){show(errMsg(e))}}
 useEffect(()=>{load()},[]);
 async function submit(){if(busy)return;setBusy(true);try{const photo_path=file?(await upload(file,'guest')).path:undefined;await api('/api/guests',jsonBody('POST',{...form,photo_path}));setForm(empty);setFile(null);setFileKey(k=>k+1);show(session.role!=='resident'?'Visita registrada 👋':'Visita registrada. El dueño ya fue notificado 👋');await load()}catch(e){show(errMsg(e))}finally{setBusy(false)}}
 async function cancel(g:Guest){if(!confirm(`¿Cancelar la visita de ${g.guest_name}?`))return;try{await api('/api/guests',jsonBody('DELETE',{id:g.id}));show('Visita cancelada');await load()}catch(e){show(errMsg(e))}}
 return <div className="grid"><div className="card span-6"><h3 className="card-title">🙋 Avisar que viene alguien</h3><div className="form">
 <div className="field"><label htmlFor="g-name">NOMBRE DEL INVITADO</label><input id="g-name" value={form.guest_name} onChange={e=>setForm({...form,guest_name:e.target.value})} placeholder="Nombre y apellido"/></div>
 <div className="field"><label htmlFor="g-date">DÍA</label><input id="g-date" type="date" min={today} value={form.visit_date} onChange={e=>setForm({...form,visit_date:e.target.value})}/></div>
 <div className="form-row"><div className="field"><label htmlFor="g-from">LLEGA</label><input id="g-from" type="time" value={form.start_time} onChange={e=>setForm({...form,start_time:e.target.value})}/></div><div className="field"><label htmlFor="g-to">SE VA</label><input id="g-to" type="time" value={form.end_time} onChange={e=>setForm({...form,end_time:e.target.value})}/></div></div>
 <div className="field"><label htmlFor="g-notes">DETALLES (opcional)</label><textarea id="g-notes" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Ej. viene a estudiar, se queda a cenar..."/></div>
 <div className="field"><label htmlFor="g-photo">IMAGEN (opcional) · 🔒 solo la ve el dueño</label><input id="g-photo" key={fileKey} type="file" accept="image/png,image/jpeg,image/webp" onChange={(e:ChangeEvent<HTMLInputElement>)=>setFile(e.target.files?.[0]||null)}/><span className="mini muted">Por ejemplo, una foto del documento del invitado.</span></div>
 <button className="button pink" disabled={busy} onClick={submit}>{busy?'ENVIANDO...':'REGISTRAR VISITA'}</button></div></div>
 <div className="card span-6"><h3 className="card-title">📅 Próximas visitas</h3>{items.map(g=><div className="notice yellow" key={g.id}><div className="notice-icon">🙋</div><div className="notice-main"><b>{g.guest_name}</b><div className="mini">{dateAR(g.visit_date)} · {g.start_time.slice(0,5)}–{g.end_time.slice(0,5)}</div><div className="mini muted">Invita: {g.users?.name||'Habitante'}{g.users?.room?` · Hab. ${g.users.room}`:''}</div>{g.notes&&<div className="mini muted">{g.notes}</div>}{session.role!=='resident'?(g.photo_url?<a href={g.photo_url} target="_blank" rel="noreferrer" className="tag green">🔒 Ver imagen</a>:<span className="tag">Sin imagen</span>):(g.resident_id===session.id&&g.has_photo&&<span className="tag green">🔒 Imagen enviada al dueño</span>)}</div>{(g.resident_id===session.id||session.role!=='resident')&&<button className="button red" onClick={()=>cancel(g)}>Cancelar</button>}</div>)}{!items.length&&<div className="empty">No hay visitas anotadas.</div>}</div></div>;
}

// ---------- Gastos de la casa (dueño) ----------
type Expense={id:string;item:string;category:string;quantity:number;amount:number;spent_on:string;notes:string|null};
const catIcon:Record<string,string>={Limpieza:'🧼',Reparación:'🔧',Mantenimiento:'🛠️',Cocina:'🍳',Otros:'📦'};
export function ExpensesSection({api,show,defaultEmail}:Props&{defaultEmail?:string|null}){
 const today=new Date().toLocaleDateString('en-CA');
 const [month,setMonth]=useState(thisMonth());const [items,setItems]=useState<Expense[]>([]);const [total,setTotal]=useState(0);
 const [form,setForm]=useState({item:'',category:'Limpieza',quantity:'1',amount:'',spent_on:today,notes:''});
 const [emailTo,setEmailTo]=useState(defaultEmail||'');
 useEffect(()=>{if(!emailTo&&defaultEmail)setEmailTo(defaultEmail)},[defaultEmail]);
 async function load(){try{const j=await api(`/api/expenses?month=${month}`);setItems(j.items||[]);setTotal(j.total||0)}catch(e){show(errMsg(e))}}
 useEffect(()=>{load()},[month]);
 async function add(){try{await api('/api/expenses',jsonBody('POST',{...form,quantity:Number(form.quantity),amount:Number(form.amount)}));show('Gasto agregado 🧾');setForm({...form,item:'',quantity:'1',amount:'',notes:''});if(form.spent_on.slice(0,7)!==month)setMonth(form.spent_on.slice(0,7));else await load()}catch(e){show(errMsg(e))}}
 async function remove(x:Expense){if(!confirm(`¿Eliminar "${x.item}"?`))return;try{await api('/api/expenses',jsonBody('DELETE',{id:x.id}));show('Gasto eliminado');await load()}catch(e){show(errMsg(e))}}
 // Resumen en texto plano para mandar por email o copiar.
 function summary(){const lines=[`Resumen de gastos · ${monthLabel(month)}`,'',...items.map(x=>`${dateAR(x.spent_on)} · ${x.item}${x.quantity>1?` ×${x.quantity}`:''} (${x.category}) · ${money(x.amount)}${x.notes?` · ${x.notes}`:''}`),'','Por categoría:',...byCat.map(([c,v])=>`- ${c}: ${money(v)}`),'',`TOTAL DEL MES: ${money(total)}`,'','Enviado desde NIDAPP'];return lines.join('\n');}
 function sendEmail(){if(!items.length)return show('No hay gastos para enviar en este mes.');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTo))return show('Escribí un email válido.');const body=summary();const url=`mailto:${encodeURIComponent(emailTo)}?subject=${encodeURIComponent(`Gastos de ${monthLabel(month)} · NIDAPP`)}&body=${encodeURIComponent(body)}`;if(url.length>1900){navigator.clipboard?.writeText(body).catch(()=>{});show('El resumen es largo: lo copié para que lo pegues en el email.');window.location.href=`mailto:${encodeURIComponent(emailTo)}?subject=${encodeURIComponent(`Gastos de ${monthLabel(month)} · NIDAPP`)}`;return;}window.location.href=url;}
 async function copySummary(){try{await navigator.clipboard.writeText(summary());show('Resumen copiado 📋')}catch{show('No se pudo copiar.')}}
 const byCat=Object.entries(items.reduce<Record<string,number>>((a,x)=>({...a,[x.category]:(a[x.category]||0)+x.amount}),{})).sort((a,b)=>b[1]-a[1]);
 return <div className="grid"><div className="card span-5"><h3 className="card-title">🧾 Agregar gasto</h3><div className="form">
 <div className="field"><label htmlFor="ex-item">ARTÍCULO O TRABAJO</label><input id="ex-item" value={form.item} onChange={e=>setForm({...form,item:e.target.value})} placeholder="Ej. Jabón, escoba, arreglo de canilla"/></div>
 <div className="form-row"><div className="field"><label htmlFor="ex-cat">CATEGORÍA</label><select id="ex-cat" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{Object.keys(catIcon).map(c=><option key={c}>{c}</option>)}</select></div><div className="field"><label htmlFor="ex-qty">CANTIDAD</label><input id="ex-qty" type="number" min={1} inputMode="numeric" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})}/></div></div>
 <div className="form-row"><div className="field"><label htmlFor="ex-amount">MONTO TOTAL</label><input id="ex-amount" type="number" min={0} inputMode="decimal" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></div><div className="field"><label htmlFor="ex-date">FECHA</label><input id="ex-date" type="date" value={form.spent_on} onChange={e=>setForm({...form,spent_on:e.target.value})}/></div></div>
 <div className="field"><label htmlFor="ex-notes">NOTA (opcional)</label><input id="ex-notes" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></div>
 <button className="button purple" onClick={add}>AGREGAR A LA LISTA</button></div></div>
 <div className="card span-7"><h3 className="card-title"><span>📒 Gastos de {monthLabel(month)}</span><input className="cell-input" type="month" aria-label="Mes" value={month} onChange={e=>e.target.value&&setMonth(e.target.value)}/></h3>
 <div className="big-number">{money(total)}</div><div className="mini muted" style={{marginBottom:10}}>{items.length} gasto{items.length===1?'':'s'} este mes{byCat.length?' · '+byCat.map(([c,v])=>`${catIcon[c]||'📦'} ${c} ${money(v)}`).join(' · '):''}</div>
 {items.map(x=><div className="notice" key={x.id}><div className="notice-icon">{catIcon[x.category]||'📦'}</div><div className="notice-main"><b>{x.item}{x.quantity>1?` ×${x.quantity}`:''}</b><div className="mini muted">{dateAR(x.spent_on)} · {x.category}{x.notes?` · ${x.notes}`:''}</div></div><b>{money(x.amount)}</b><button className="button red" aria-label={`Eliminar ${x.item}`} onClick={()=>remove(x)}>✕</button></div>)}
 {!items.length&&<div className="empty">No hay gastos cargados en este mes.</div>}
 <div className="email-box"><h3 className="card-title">📧 Enviar resumen por email</h3><div className="field"><label htmlFor="ex-mail">PARA</label><input id="ex-mail" type="email" autoComplete="email" value={emailTo} onChange={e=>setEmailTo(e.target.value)} placeholder="correo@ejemplo.com"/></div><div className="row-actions" style={{marginTop:10}}><button className="button blue" onClick={sendEmail}>📧 ENVIAR RESUMEN</button><button className="button" onClick={copySummary}>📋 Copiar</button></div><p className="mini muted">Se abre tu app de correo con el resumen de {monthLabel(month)} listo para enviar.</p></div></div></div>;
}
