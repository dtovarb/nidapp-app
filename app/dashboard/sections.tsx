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
 <p className="mini muted">{rooms.length} habitaciones · {totalPeople} de {totalCapacity} lugares ocupados. El precio es por habitación: si la comparten, se divide entre quienes viven ahí.</p>
 <div className="table-wrap"><table className="table"><thead><tr><th>HAB.</th><th>OCUPACIÓN</th><th>CUPO</th><th>PRECIO MENSUAL</th><th>POR PERSONA</th><th></th></tr></thead><tbody>{rooms.map(r=>{const d=draft[r.id]||{capacity:'1',price:'0'};const changed=d.capacity!==String(r.capacity)||d.price!==String(r.price??0);const per=Number(d.price||0)/Math.max(1,r.occupants);return <tr key={r.id}><td className="cell-head"><b>Habitación {r.number}</b></td><td data-label="OCUPACIÓN"><span className={'status '+(r.occupants>=r.capacity?'pending':'paid')}>{r.occupants}/{r.capacity}</span></td><td data-label="CUPO"><input className="cell-input" type="number" min={1} max={10} aria-label={`Cupo habitación ${r.number}`} value={d.capacity} onChange={e=>setDraft({...draft,[r.id]:{...d,capacity:e.target.value}})}/></td><td data-label="PRECIO MENSUAL"><input className="cell-input wide" type="number" min={0} step={1000} aria-label={`Precio habitación ${r.number}`} value={d.price} onChange={e=>setDraft({...draft,[r.id]:{...d,price:e.target.value}})}/></td><td data-label="POR PERSONA" className="muted">{r.occupants?money(per):'—'}</td><td className="cell-actions"><div className="row-actions">{changed&&<button className="button" onClick={()=>save(r)}>Guardar</button>}{r.occupants===0&&<button className="button red" onClick={()=>remove(r)} aria-label={`Quitar habitación ${r.number}`}>Quitar</button>}</div></td></tr>})}</tbody></table></div></div>;
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

// ---------- Tareas mensuales que rotan por habitación ----------
type TaskData={month:string;tasks:{id:string;name:string}[];assignments:{id:string;task_id:string;room:string;done:boolean;done_at:string|null}[];calendar:{month:string;items:{task_id:string;room:string|null;done:boolean}[]}[]};
const taskIcon=(name:string)=>/basura/i.test(name)?'🗑️':/baño/i.test(name)?'🚽':/cocina/i.test(name)?'🍳':'🧹';
export function TasksSection({api,show,session,rooms}:Props&{rooms:Room[]}){
 const [data,setData]=useState<TaskData|null>(null);const [newTask,setNewTask]=useState('');
 async function load(){try{setData(await api('/api/tasks'))}catch(e){show(errMsg(e))}}
 useEffect(()=>{load()},[]);
 async function run(url:string,init:RequestInit,msg:string){try{await api(url,init);show(msg);await load()}catch(e){show(errMsg(e))}}
 if(!data)return <div className="card empty">Cargando tareas...</div>;
 const isOwner=session.role==='owner';
 const name=(id:string)=>data.tasks.find(t=>t.id===id)?.name||'Tarea';
 const mine=data.assignments.filter(a=>a.room===session.room);
 const toggle=(a:{id:string;done:boolean})=>run('/api/tasks',jsonBody('PATCH',{id:a.id,done:!a.done}),a.done?'Tarea marcada como pendiente':'¡Tarea terminada! Ya les avisamos a todos ✅');
 return <div className="grid">
 {!isOwner&&<div className="card span-12"><h3 className="card-title">🧹 Tu tarea de {monthLabel(data.month)}</h3>{mine.length?mine.map(a=><div className={'notice '+(a.done?'green':'yellow')} key={a.id}><div className="notice-icon">{a.done?'✅':taskIcon(name(a.task_id))}</div><div className="notice-main"><b>{name(a.task_id)}</b><div className="mini">{a.done&&a.done_at?`Terminada el ${new Date(a.done_at).toLocaleDateString('es-AR')}`:'Cuando la termines, marcala así se enteran todos.'}</div></div><button className={'button '+(a.done?'yellow':'')} onClick={()=>toggle(a)}>{a.done?'Desmarcar':'✅ Marcar terminada'}</button></div>):<div className="empty">Este mes tu habitación no tiene tareas asignadas. 🎉</div>}</div>}
 <div className="card span-12"><h3 className="card-title"><span>📋 Tareas de {monthLabel(data.month)}</span></h3>{data.assignments.length?<div className="task-cards">{data.tasks.map(t=>{const a=data.assignments.find(x=>x.task_id===t.id);if(!a)return null;const canMark=isOwner||a.room===session.room;return <div key={t.id} className={'task-card '+(a.done?'done':'')}><div className="task-card-icon">{a.done?'✅':taskIcon(t.name)}</div><b>{t.name}</b>{isOwner?<select className="cell-input" aria-label={`Habitación para ${t.name}`} value={a.room} onChange={e=>run('/api/tasks',jsonBody('PATCH',{id:a.id,room:e.target.value}),`Ahora le toca a la habitación ${e.target.value}`)}>{rooms.map(r=><option key={r.id} value={r.number}>Hab. {r.number}</option>)}</select>:<span className={'room-chip '+(a.room===session.room?'mine':'')}>Hab. {a.room}{a.room===session.room?' · vos':''}</span>}<span className={'status '+(a.done?'paid':'due')}>{a.done?`TERMINADA${a.done_at?' · '+new Date(a.done_at).toLocaleDateString('es-AR',{day:'numeric',month:'numeric'}):''}`:'PENDIENTE'}</span>{canMark&&<button className={'button '+(a.done?'yellow':'')} onClick={()=>toggle(a)}>{a.done?'Desmarcar':'Marcar terminada'}</button>}</div>})}</div>:<div className="empty">No hay habitaciones ocupadas para asignar tareas.</div>}
 <p className="mini muted">Cuando alguien marca su tarea como terminada, le llega una notificación al dueño y al resto de la casa.{isOwner?' Podés cambiar la habitación a mano y se le avisa por notificación.':''}</p></div>
 <div className="card span-12"><h3 className="card-title">🗓️ Calendario de tareas</h3><div className="task-calendar">{data.calendar.map((c,k)=><div key={c.month} className={'task-month '+(k===0?'current':'')}><div className="task-month-name">{monthLabel(c.month).replace(/^./,x=>x.toUpperCase())}{k===0&&<span className="tag green">ESTE MES</span>}</div>{c.items.map(i=><div key={i.task_id} className="task-month-row"><span>{taskIcon(name(i.task_id))} {name(i.task_id)}</span><span className={'room-chip '+(i.room&&i.room===session.room?'mine':'')}>{i.room?`Hab. ${i.room}`:'—'}{k===0&&i.done?' ✅':''}</span></div>)}{!c.items.length&&<div className="mini muted">Sin tareas</div>}</div>)}</div><p className="mini muted">Las tareas rotan solas cada mes entre las habitaciones ocupadas. Los meses futuros son una vista previa: si cambian los habitantes, la rotación se ajusta.{!isOwner&&session.room?' Tu habitación aparece resaltada.':''}</p></div>
 {isOwner&&<div className="card span-12"><h3 className="card-title">⚙️ Lista de tareas</h3>{data.tasks.map(t=><div className="notice" key={t.id}><div className="notice-icon">{taskIcon(t.name)}</div><div className="notice-main"><b>{t.name}</b></div><button className="button red" onClick={()=>confirm(`¿Eliminar la tarea "${t.name}"?`)&&run('/api/tasks',jsonBody('DELETE',{id:t.id}),'Tarea eliminada')}>Eliminar</button></div>)}<div className="form-row" style={{marginTop:10}}><div className="field"><label htmlFor="task-new">NUEVA TAREA</label><input id="task-new" value={newTask} onChange={e=>setNewTask(e.target.value)} placeholder="Ej. Limpiar la cocina"/></div><div className="field" style={{alignSelf:'end'}}><button className="button purple" onClick={async()=>{await run('/api/tasks',jsonBody('POST',{name:newTask}),'Tarea agregada');setNewTask('')}}>AGREGAR TAREA</button></div></div><p className="mini muted">Las tareas nuevas se asignan desde el mes que viene.</p></div>}
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
 const isOwner=session.role==='owner';
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
 async function submit(){if(busy)return;setBusy(true);try{const photo_path=file?(await upload(file,'guest')).path:undefined;await api('/api/guests',jsonBody('POST',{...form,photo_path}));setForm(empty);setFile(null);setFileKey(k=>k+1);show(session.role==='owner'?'Visita registrada 👋':'Visita registrada. El dueño ya fue notificado 👋');await load()}catch(e){show(errMsg(e))}finally{setBusy(false)}}
 async function cancel(g:Guest){if(!confirm(`¿Cancelar la visita de ${g.guest_name}?`))return;try{await api('/api/guests',jsonBody('DELETE',{id:g.id}));show('Visita cancelada');await load()}catch(e){show(errMsg(e))}}
 return <div className="grid"><div className="card span-6"><h3 className="card-title">🙋 Avisar que viene alguien</h3><div className="form">
 <div className="field"><label htmlFor="g-name">NOMBRE DEL INVITADO</label><input id="g-name" value={form.guest_name} onChange={e=>setForm({...form,guest_name:e.target.value})} placeholder="Nombre y apellido"/></div>
 <div className="field"><label htmlFor="g-date">DÍA</label><input id="g-date" type="date" min={today} value={form.visit_date} onChange={e=>setForm({...form,visit_date:e.target.value})}/></div>
 <div className="form-row"><div className="field"><label htmlFor="g-from">LLEGA</label><input id="g-from" type="time" value={form.start_time} onChange={e=>setForm({...form,start_time:e.target.value})}/></div><div className="field"><label htmlFor="g-to">SE VA</label><input id="g-to" type="time" value={form.end_time} onChange={e=>setForm({...form,end_time:e.target.value})}/></div></div>
 <div className="field"><label htmlFor="g-notes">DETALLES (opcional)</label><textarea id="g-notes" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Ej. viene a estudiar, se queda a cenar..."/></div>
 <div className="field"><label htmlFor="g-photo">IMAGEN (opcional) · 🔒 solo la ve el dueño</label><input id="g-photo" key={fileKey} type="file" accept="image/png,image/jpeg,image/webp" onChange={(e:ChangeEvent<HTMLInputElement>)=>setFile(e.target.files?.[0]||null)}/><span className="mini muted">Por ejemplo, una foto del documento del invitado.</span></div>
 <button className="button pink" disabled={busy} onClick={submit}>{busy?'ENVIANDO...':'REGISTRAR VISITA'}</button></div></div>
 <div className="card span-6"><h3 className="card-title">📅 Próximas visitas</h3>{items.map(g=><div className="notice yellow" key={g.id}><div className="notice-icon">🙋</div><div className="notice-main"><b>{g.guest_name}</b><div className="mini">{dateAR(g.visit_date)} · {g.start_time.slice(0,5)}–{g.end_time.slice(0,5)}</div><div className="mini muted">Invita: {g.users?.name||'Habitante'}{g.users?.room?` · Hab. ${g.users.room}`:''}</div>{g.notes&&<div className="mini muted">{g.notes}</div>}{session.role==='owner'?(g.photo_url?<a href={g.photo_url} target="_blank" rel="noreferrer" className="tag green">🔒 Ver imagen</a>:<span className="tag">Sin imagen</span>):(g.resident_id===session.id&&g.has_photo&&<span className="tag green">🔒 Imagen enviada al dueño</span>)}</div>{(g.resident_id===session.id||session.role==='owner')&&<button className="button red" onClick={()=>cancel(g)}>Cancelar</button>}</div>)}{!items.length&&<div className="empty">No hay visitas anotadas.</div>}</div></div>;
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
