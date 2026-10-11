'use client';
import { money, dateAR } from './sections';

export type HistoryPayment={id:string;resident_id:string;due_date:string;total:number;paid:boolean;paid_at:string|null;overdue:boolean;cancelled?:boolean;cancel_reason?:string|null;cancelled_at?:string|null;reported_at?:string|null;proof_url?:string|null;users?:{name:string;room:string|null;active?:boolean}|null};

// Los meses del historial, del más nuevo al más viejo (AAAA-MM).
function monthsBetween(from:string,to:string){const out:string[]=[];let [y,m]=to.split('-').map(Number);const [fy,fm]=from.split('-').map(Number);while(y>fy||(y===fy&&m>=fm)){out.push(`${y}-${String(m).padStart(2,'0')}`);m--;if(!m){m=12;y--;}}return out;}
const monthShort=(key:string)=>{const [y,m]=key.split('-').map(Number);return new Date(y,m-1,1).toLocaleDateString('es-AR',{month:'short'}).replace('.','')+(m===1?` ${String(y).slice(2)}`:'');};
const monthLong=(key:string)=>{const [y,m]=key.split('-').map(Number);return new Date(y,m-1,1).toLocaleDateString('es-AR',{month:'long',year:'numeric'});};
export function statusOf(p?:HistoryPayment){if(!p)return {cls:'none',icon:'—',text:'Sin cobro'};if(p.cancelled)return {cls:'cancelled',icon:'⊘',text:'Anulado'};if(p.paid)return {cls:'paid',icon:'✅',text:'Pagó'};if(p.overdue)return {cls:'overdue',icon:'⚠️',text:'Vencido'};if(p.reported_at)return {cls:'reported',icon:'💸',text:'Avisó que pagó'};return {cls:'pending',icon:'⏳',text:'Pendiente'};}

// Registro del dueño: una fila por habitante y un casillero por mes, para ver de un vistazo
// quién pagó y quién no. Los cobros anulados siguen visibles y se pueden restaurar.
export function OwnerRentLog({history,from,due,onRestore}:{history:HistoryPayment[];from:string;due:string;onRestore:(p:HistoryPayment)=>void}){
 const months=monthsBetween(from.slice(0,7),due.slice(0,7));
 const people=[...new Map(history.map(p=>[p.resident_id,{id:p.resident_id,name:p.users?.name||'Ex habitante',room:p.users?.room||null,active:p.users?.active!==false}])).values()].sort((a,b)=>Number(b.active)-Number(a.active)||a.name.localeCompare(b.name));
 const cell=(rid:string,month:string)=>history.find(p=>p.resident_id===rid&&p.due_date.slice(0,7)===month);
 const cancelled=history.filter(p=>p.cancelled);
 const owed=(rid:string)=>history.filter(p=>p.resident_id===rid&&!p.paid&&!p.cancelled).reduce((a,p)=>a+p.total,0);
 return <div className="card span-12"><h3 className="card-title">📒 Registro de pagos</h3>
 <p className="mini muted">Últimos {months.length} meses. Cada casillero muestra cómo quedó ese mes. Tocá un casillero para ver el detalle.</p>
 <div className="log-legend"><span className="log-cell paid">✅ Pagó</span><span className="log-cell pending">⏳ Pendiente</span><span className="log-cell reported">💸 Avisó que pagó</span><span className="log-cell overdue">⚠️ Vencido</span><span className="log-cell cancelled">⊘ Anulado</span></div>
 {people.map(person=>{const debt=owed(person.id);return <div key={person.id} className={'log-row'+(person.active?'':' inactive')}><div className="log-person"><b>{person.name}</b><span className="mini muted">{person.room?`Hab. ${person.room}`:''}{person.active?'':' · desactivado'}</span>{debt>0?<span className="tag red">Debe {money(debt)}</span>:<span className="tag green">Al día</span>}</div><div className="log-months">{months.map(month=>{const p=cell(person.id,month);const st=statusOf(p);return <details key={month} className={'log-cell '+st.cls}><summary aria-label={`${person.name}, ${monthLong(month)}: ${st.text}`}><span className="log-month">{monthShort(month)}</span><span>{st.icon}</span></summary><div className="log-detail"><b>{monthLong(month)}</b><div>{st.text}{p?` · ${money(p.total)}`:''}</div>{p?.paid&&p.paid_at&&<div>Confirmado el {new Date(p.paid_at).toLocaleDateString('es-AR')}</div>}{p&&!p.paid&&!p.cancelled&&<div>Vence el {dateAR(p.due_date)}</div>}{p?.reported_at&&!p.paid&&<div>Avisó el {new Date(p.reported_at).toLocaleDateString('es-AR')}</div>}{p?.proof_url&&<a href={p.proof_url} target="_blank" rel="noreferrer">Ver comprobante</a>}{p?.cancelled&&<><div>Anulado{p.cancelled_at?` el ${new Date(p.cancelled_at).toLocaleDateString('es-AR')}`:''}{p.cancel_reason?`: ${p.cancel_reason}`:''}</div><button className="button" onClick={()=>onRestore(p)}>Restaurar</button></>}</div></details>})}</div></div>})}
 {!people.length&&<div className="empty">Todavía no hay pagos registrados.</div>}
 {cancelled.length>0&&<div className="cancelled-list"><h4>⊘ Cobros anulados</h4>{cancelled.map(p=><div key={p.id} className="notice"><div className="notice-main"><b>{p.users?.name||'Ex habitante'} · {monthLong(p.due_date.slice(0,7))}</b><div className="mini muted">{money(p.total)}{p.cancel_reason?` · ${p.cancel_reason}`:''}</div></div><button className="button" onClick={()=>onRestore(p)}>Restaurar</button></div>)}</div>}
 </div>;
}

// Historial del habitante: sus pagos de los últimos meses, con el estado de cada uno.
export function ResidentRentHistory({history}:{history:HistoryPayment[]}){
 const rows=[...history].sort((a,b)=>b.due_date.localeCompare(a.due_date));
 return <div className="card span-12"><h3 className="card-title">📒 Historial de pagos</h3>{rows.map(p=>{const st=statusOf(p);return <div key={p.id} className={'history-row '+st.cls}><div className="history-month"><b>{monthLong(p.due_date.slice(0,7))}</b><span className="mini muted">Vence el {dateAR(p.due_date)}</span></div><div className="history-amount">{money(p.total)}</div><div className="history-status"><span className={'log-cell '+st.cls}>{st.icon} {st.text}</span>{p.paid&&p.paid_at&&<span className="mini muted">el {new Date(p.paid_at).toLocaleDateString('es-AR')}</span>}</div></div>})}{!rows.length&&<div className="empty">Todavía no hay pagos registrados.</div>}<p className="mini muted">Se muestran los últimos 6 meses.</p></div>;
}
