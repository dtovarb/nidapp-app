'use client';
import { useEffect, useMemo, useState } from 'react';
import type { SessionUser } from '@/lib/auth';
import { ExpensesSection, money, dateAR, monthLabel, jsonBody } from './sections';
import { OwnerRentLog, statusOf, type HistoryPayment } from './rent-history';

type Api=(url:string,options?:RequestInit)=>Promise<any>;
type Props={api:Api;show:(s:string)=>void;session:SessionUser};
export type Point={month:string;rent:number;other:number;income:number;expenses:number;profit:number;pending:number};
export type FinanceData={home:string;month:string;months:string[];series:Point[];payments:(HistoryPayment&{name:string;room:string|null})[];detail:{collected:{id:string;name:string;room:string|null;due_date:string;paid_at:string;total:number}[];incomes:{id:string;concept:string;category:string;amount:number;received_on:string;notes:string|null}[];expenses:{id:string;item:string;category:string;quantity:number;amount:number;spent_on:string;notes:string|null}[]}};
const errMsg=(e:unknown)=>e instanceof Error?e.message:'Error';
const thisMonth=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;};
const shortMonth=(k:string)=>{const [y,m]=k.split('-').map(Number);const s=new Date(y,m-1,1).toLocaleDateString('es-AR',{month:'short'}).replace('.','');return m===1?`${s} ${String(y).slice(2)}`:s;};
// Montos cortos para el eje: 1,2 M · 350 k · 900
export const compact=(n:number)=>{const a=Math.abs(n);const sign=n<0?'−':'';if(a>=1e6)return `${sign}${(a/1e6).toLocaleString('es-AR',{maximumFractionDigits:1})} M`;if(a>=1e3)return `${sign}${Math.round(a/1e3)} k`;return `${sign}${Math.round(a)}`;};

// ---------- Gráfico: ingresos y gastos (barras) y ganancia (línea), un solo eje en pesos ----------
export function FinanceChart({series:all,printable=false}:{series:Point[];printable?:boolean}){
 const [hover,setHover]=useState<number|null>(null);const [table,setTable]=useState(false);
 // En celular se muestran los últimos 6 meses para que se lea bien.
 const [narrow,setNarrow]=useState(false);
 useEffect(()=>{if(printable)return;const mq=window.matchMedia('(max-width:600px)');const f=()=>setNarrow(mq.matches);f();mq.addEventListener('change',f);return()=>mq.removeEventListener('change',f)},[printable]);
 const series=narrow?all.slice(-6):all;
 const W=Math.max(320,series.length*58+56),H=240,L=50,R=10,T=14,B=28;const pw=W-L-R,ph=H-T-B;
 const maxV=Math.max(1,...series.flatMap(p=>[p.income,p.expenses,p.profit]));const minV=Math.min(0,...series.map(p=>p.profit));
 const step=(()=>{const raw=(maxV-minV)/4;const mag=10**Math.floor(Math.log10(raw||1));return Math.ceil(raw/mag/(raw/mag>5?2:1))*mag*(raw/mag>5?2:1);})();
 const top=Math.ceil(maxV/step)*step,bottom=Math.floor(minV/step)*step;
 const y=(v:number)=>T+ph*(top-v)/((top-bottom)||1);const band=pw/series.length;const x=(i:number)=>L+band*i+band/2;
 const bw=Math.min(18,band/3);const ticks:number[]=[];for(let v=bottom;v<=top+1e-6;v+=step)ticks.push(v);
 const bar=(cx:number,v:number)=>{const y0=y(0),y1=y(Math.max(0,v));const h=Math.max(0,y0-y1);const r=Math.min(4,h);return `M${cx-bw/2},${y0}V${y1+r}Q${cx-bw/2},${y1} ${cx-bw/2+r},${y1}H${cx+bw/2-r}Q${cx+bw/2},${y1} ${cx+bw/2},${y1+r}V${y0}Z`;};
 const line=series.map((p,i)=>`${i?'L':'M'}${x(i)},${y(p.profit)}`).join('');
 const last=series.length-1;const hp=hover!==null?series[hover]:null;
 return <div className={'fin-chart'+(narrow?' narrow':'')}>
  <div className="fin-legend" aria-hidden><span><i className="sw income"/>Ingresos</span><span><i className="sw expense"/>Gastos</span><span><i className="sw profit"/>Ganancia</span>{!printable&&<button className="linklike" onClick={()=>setTable(t=>!t)}>{table?'Ver gráfico':'Ver como tabla'}</button>}</div>
  {table&&!printable?<FinanceTable series={series}/>:<div className="fin-svg-wrap" onMouseLeave={()=>setHover(null)}>
   <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Ingresos, gastos y ganancia de ${monthLabel(series[0].month)} a ${monthLabel(series[last].month)}`}>
    {ticks.map(v=><g key={v}><line x1={L} x2={W-R} y1={y(v)} y2={y(v)} className={v===0?'axis0':'grid'}/><text x={L-6} y={y(v)+4} className="tick" textAnchor="end">{compact(v)}</text></g>)}
    {series.map((p,i)=><g key={p.month}>
     {hover===i&&<rect x={L+band*i+2} y={T} width={band-4} height={ph} className="hover-band"/>}
     <path d={bar(x(i)-bw/2-1,p.income)} className="bar income"/>
     <path d={bar(x(i)+bw/2+1,p.expenses)} className="bar expense"/>
     <text x={x(i)} y={H-8} className="tick" textAnchor="middle">{shortMonth(p.month)}</text>
     <rect x={L+band*i} y={T} width={band} height={ph} fill="transparent" onMouseEnter={()=>setHover(i)} onClick={()=>setHover(i)}/>
    </g>)}
    <path d={line} className="profit-line"/>
    {series.map((p,i)=><circle key={p.month} cx={x(i)} cy={y(p.profit)} r={hover===i||i===last?5:4} className="profit-dot" pointerEvents="none"/>)}
    <text x={x(last)-10} y={Math.max(T+12,y(series[last].profit)-10)} className="direct-label" textAnchor="end">{compact(series[last].profit)}</text>
   </svg>
   {hp&&!printable&&<div className="fin-tip" style={{left:`${(x(hover!)/W)*100}%`}}><b>{monthLabel(hp.month)}</b><div><i className="sw income"/>Ingresos <b>{money(hp.income)}</b></div><div><i className="sw expense"/>Gastos <b>{money(hp.expenses)}</b></div><div><i className="sw profit"/>Ganancia <b>{money(hp.profit)}</b></div>{hp.pending>0&&<div className="mini muted">Sin cobrar: {money(hp.pending)}</div>}</div>}
  </div>}
 </div>;
}
// ---------- Torta (dona): reparto de un total en porciones ----------
const SLICE_COLORS=['#2a78d6','#eb6834','#1baf7a','#eda100','#e87ba4','#008300'];
export type Slice={label:string;value:number};
export function DonutChart({title,slices,empty}:{title:string;slices:Slice[];empty:string}){
 const [hover,setHover]=useState<number|null>(null);
 // Máximo 6 porciones: lo que sobra se junta en "Otros".
 const sorted=slices.filter(s=>s.value>0).sort((a,b)=>b.value-a.value);
 const list=sorted.length>6?[...sorted.slice(0,5),{label:'Otros',value:sorted.slice(5).reduce((a,s)=>a+s.value,0)}]:sorted;
 const total=list.reduce((a,s)=>a+s.value,0);
 const R=80,r=50,C=100;let angle=-Math.PI/2;
 const arcs=list.map((s,i)=>{const a0=angle,a1=angle+(s.value/total)*Math.PI*2;angle=a1;const big=a1-a0>Math.PI?1:0;const p=(rad:number,ang:number)=>`${C+rad*Math.cos(ang)},${C+rad*Math.sin(ang)}`;
  const d=list.length===1?`M${C-R},${C}A${R},${R} 0 1 1 ${C+R},${C}A${R},${R} 0 1 1 ${C-R},${C}ZM${C-r},${C}A${r},${r} 0 1 0 ${C+r},${C}A${r},${r} 0 1 0 ${C-r},${C}Z`:`M${p(R,a0)}A${R},${R} 0 ${big} 1 ${p(R,a1)}L${p(r,a1)}A${r},${r} 0 ${big} 0 ${p(r,a0)}Z`;return {d,color:SLICE_COLORS[i],...s};});
 const h=hover!==null?list[hover]:null;
 const pct=(v:number)=>{const x=v/total*100;return x>0&&x<1?'<1%':`${Math.round(x)}%`;};
 return <div className="donut"><h4>{title}</h4>{!total?<div className="empty">{empty}</div>:<div className="donut-body">
  <svg viewBox="0 0 200 200" role="img" aria-label={`${title}: ${list.map(s=>`${s.label} ${Math.round(s.value/total*100)}%`).join(', ')}`} onMouseLeave={()=>setHover(null)}>
   {arcs.map((a,i)=><path key={a.label} d={a.d} fill={a.color} fillRule="evenodd" className={'slice'+(hover!==null&&hover!==i?' dim':'')} onMouseEnter={()=>setHover(i)} onClick={()=>setHover(i)}/>)}
   <text x={C} y={C-4} textAnchor="middle" className="donut-center">{h?pct(h.value):compact(total)}</text>
   <text x={C} y={C+14} textAnchor="middle" className="donut-sub">{h?h.label:'total'}</text>
  </svg>
  <ul className="donut-legend">{list.map((s,i)=><li key={s.label} className={hover===i?'on':''} onMouseEnter={()=>setHover(i)} onMouseLeave={()=>setHover(null)}><i className="sw" style={{background:SLICE_COLORS[i]}}/><span className="donut-label">{s.label}</span><b>{money(s.value)}</b><span className="mini muted">{pct(s.value)}</span></li>)}</ul>
 </div>}</div>;
}
// Las dos tortas del mes: de dónde vino la plata y a dónde fue.
export function MonthDonuts({data}:{data:FinanceData}){
 const cur=data.series.find(s=>s.month===data.month);if(!cur)return null;
 const byCat=<T,>(items:T[],cat:(x:T)=>string,val:(x:T)=>number)=>Object.entries(items.reduce<Record<string,number>>((a,x)=>({...a,[cat(x)]:(a[cat(x)]||0)+val(x)}),{})).map(([label,value])=>({label,value}));
 const incomeSlices=[{label:'Alquileres',value:cur.rent},...byCat(data.detail.incomes,i=>i.category,i=>i.amount)];
 const outSlices=[...byCat(data.detail.expenses,x=>`Gastos: ${x.category}`,x=>x.amount),...(cur.profit>0?[{label:'Ganancia',value:cur.profit}]:[])];
 return <div className="donuts"><DonutChart title="¿De dónde vino la plata?" slices={incomeSlices} empty="No hubo ingresos este mes."/><DonutChart title="¿A dónde fue?" slices={outSlices} empty="No hubo gastos ni ganancia este mes."/>{cur.profit<0&&<p className="mini neg">Este mes los gastos superaron a los ingresos por {money(-cur.profit)}.</p>}</div>;
}

export function FinanceTable({series}:{series:Point[]}){
 return <div className="table-wrap"><table className="table fin-table"><thead><tr><th>MES</th><th>ALQUILERES</th><th>OTROS INGRESOS</th><th>GASTOS</th><th>GANANCIA</th><th>SIN COBRAR</th></tr></thead><tbody>{[...series].reverse().map(p=><tr key={p.month}><td className="cell-head"><b className="cap">{monthLabel(p.month)}</b></td><td data-label="ALQUILERES">{money(p.rent)}</td><td data-label="OTROS INGRESOS">{money(p.other)}</td><td data-label="GASTOS">{money(p.expenses)}</td><td data-label="GANANCIA"><b className={p.profit<0?'neg':''}>{money(p.profit)}</b></td><td data-label="SIN COBRAR">{money(p.pending)}</td></tr>)}</tbody></table></div>;
}

// Resumen del mes en texto, para mandar por email.
export function summaryText(d:FinanceData){
 const p=d.series.find(s=>s.month===d.month)!;
 return [`Finanzas de ${d.home} · ${monthLabel(d.month)}`,'',`Alquileres cobrados: ${money(p.rent)}`,`Otros ingresos: ${money(p.other)}`,`Gastos: ${money(p.expenses)}`,`GANANCIA: ${money(p.profit)}`,`Sin cobrar del mes: ${money(p.pending)}`,'',
  'Pagos cobrados:',...d.detail.collected.map(c=>`- ${c.name}${c.room?` (Hab. ${c.room})`:''}: ${money(c.total)} · ${new Date(c.paid_at).toLocaleDateString('es-AR')}`),
  ...(d.detail.incomes.length?['','Otros ingresos:',...d.detail.incomes.map(i=>`- ${i.concept} (${i.category}): ${money(i.amount)}`)]:[]),
  ...(d.detail.expenses.length?['','Gastos:',...d.detail.expenses.map(x=>`- ${x.item}${x.quantity>1?` ×${x.quantity}`:''} (${x.category}): ${money(x.amount)}`)]:[]),
  '','Enviado desde NIDAPP'].join('\n');
}

// ---------- Sección Finanzas: Resumen · Pagos · Ingresos · Gastos ----------
export function FinanceSection({api,show,session,defaultEmail}:Props&{defaultEmail?:string|null}){
 const [view,setView]=useState<'resumen'|'pagos'|'ingresos'|'gastos'>('resumen');
 const [month,setMonth]=useState(thisMonth());const [data,setData]=useState<FinanceData|null>(null);const [chartType,setChartType]=useState<'barras'|'torta'>('barras');const [email,setEmail]=useState(defaultEmail||'');
 async function load(){try{setData(await api(`/api/finance?month=${month}&months=12`))}catch(e){show(errMsg(e))}}
 useEffect(()=>{load()},[month]);useEffect(()=>{if(!email&&defaultEmail)setEmail(defaultEmail)},[defaultEmail]);
 const cur=data?.series.find(s=>s.month===month);const prev=data?.series[data.series.length-2];
 function sendEmail(){if(!data)return;if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return show('Escribí un email válido.');const body=summaryText(data);const subject=`Finanzas de ${monthLabel(month)} · ${data.home}`;let url=`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;if(url.length>1900){navigator.clipboard?.writeText(body).catch(()=>{});show('El resumen es largo: lo copié para que lo pegues.');url=`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}`;}window.location.href=url;}
 const tabs:[typeof view,string][]= [['resumen','📊 Resumen'],['pagos','💵 Pagos'],['ingresos','➕ Ingresos'],['gastos','🧾 Gastos']];
 return <div className="grid">
  <div className="card span-12 fin-top"><div className="fin-tabs" role="tablist">{tabs.map(([k,l])=><button key={k} role="tab" aria-selected={view===k} className={view===k?'active':''} onClick={()=>setView(k)}>{l}</button>)}</div>
   {view!=='gastos'&&<div className="fin-month"><button className="button blue" aria-label="Mes anterior" onClick={()=>{const [y,m]=month.split('-').map(Number);const d=new Date(y,m-2,1);setMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)}}>←</button><b className="cap">{monthLabel(month)}</b><button className="button blue" aria-label="Mes siguiente" onClick={()=>{const [y,m]=month.split('-').map(Number);const d=new Date(y,m,1);setMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)}}>→</button></div>}</div>
  {!data&&view!=='gastos'?<div className="card span-12 empty">Cargando finanzas...</div>:<>
  {view==='resumen'&&data&&cur&&<>
   <div className="span-12 kpis">
    <div className="card kpi"><span className="mini muted">Ingresos</span><b>{money(cur.income)}</b><span className="mini muted">Alquileres {money(cur.rent)} · otros {money(cur.other)}</span></div>
    <div className="card kpi"><span className="mini muted">Gastos</span><b>{money(cur.expenses)}</b><span className="mini muted">{data.detail.expenses.length} gasto{data.detail.expenses.length===1?'':'s'}</span></div>
    <div className={'card kpi hero-kpi'+(cur.profit<0?' neg':'')}><span className="mini">Ganancia del mes</span><b>{money(cur.profit)}</b>{prev&&prev.month!==cur.month&&<span className="mini">{cur.profit>=prev.profit?'▲':'▼'} {money(Math.abs(cur.profit-prev.profit))} vs. {monthLabel(prev.month).split(' ')[0]}</span>}</div>
    <div className="card kpi"><span className="mini muted">Sin cobrar del mes</span><b>{money(cur.pending)}</b><span className="mini muted">alquiler pendiente o vencido</span></div>
   </div>
   <div className="card span-12"><h3 className="card-title"><span>{chartType==='barras'?'📈 Ganancia mensual':`🥧 Reparto de ${monthLabel(month)}`}</span><span className="chart-switch" role="tablist"><button role="tab" aria-selected={chartType==='barras'} className={chartType==='barras'?'active':''} onClick={()=>setChartType('barras')}>📊 Barras</button><button role="tab" aria-selected={chartType==='torta'} className={chartType==='torta'?'active':''} onClick={()=>setChartType('torta')}>🥧 Torta</button></span></h3>{chartType==='barras'?<FinanceChart series={data.series}/>:<MonthDonuts data={data}/>}<p className="mini muted">Los alquileres cuentan en el mes en que confirmaste el pago; los otros ingresos y los gastos, en el mes de su fecha. Tocá o pasá el mouse sobre un mes para ver el detalle.</p></div>
   <div className="card span-12"><h3 className="card-title">📤 Compartir el resumen de {monthLabel(month)}</h3><div className="share-row"><a className="button purple" href={`/reporte?mes=${month}`} target="_blank" rel="noreferrer">🖨️ Imprimir o guardar PDF</a><div className="field"><label htmlFor="fin-mail">ENVIAR POR EMAIL A</label><input id="fin-mail" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="correo@ejemplo.com"/></div><button className="button blue" onClick={sendEmail}>📧 Enviar resumen</button></div><p className="mini muted">El PDF se genera desde el reporte: en la ventana de impresión elegí "Guardar como PDF". El email abre tu app de correo con el resumen; si querés, adjuntá el PDF.</p></div>
  </>}
  {view==='pagos'&&data&&<PaymentsLedger data={data} api={api} show={show} reload={load}/>}
  {view==='ingresos'&&<IncomesPanel api={api} show={show} month={month} onChange={load}/>}
  {view==='gastos'&&<div className="span-12"><ExpensesSection api={api} show={show} session={session} defaultEmail={defaultEmail}/></div>}
  </>}
 </div>;
}

// ---------- Pagos: registro por habitante + lista con filtros ----------
function PaymentsLedger({data,api,show,reload}:{data:FinanceData;api:Api;show:(s:string)=>void;reload:()=>Promise<void>}){
 const [status,setStatus]=useState('todos');const [person,setPerson]=useState('todos');
 const people=useMemo(()=>[...new Map(data.payments.map(p=>[p.resident_id,p.name])).entries()].sort((a,b)=>a[1].localeCompare(b[1])),[data.payments]);
 const list=data.payments.filter(p=>(person==='todos'||p.resident_id===person)&&(status==='todos'||statusOf(p).cls===status));
 const from=data.months[Math.max(0,data.months.length-6)]+'-01';const due=data.month+'-05';
 async function restore(p:{id:string}){try{await api('/api/rent',jsonBody('PATCH',{id:p.id,restore:true}));show('Cobro restaurado ✅');await reload()}catch(e){show(errMsg(e))}}
 const totals={cobrado:list.filter(p=>p.paid&&!p.cancelled).reduce((a,p)=>a+p.total,0),debe:list.filter(p=>!p.paid&&!p.cancelled).reduce((a,p)=>a+p.total,0)};
 return <>
  <OwnerRentLog history={data.payments.filter(p=>p.due_date>=from).map(p=>({...p,users:{name:p.name,room:p.room}}))} from={from} due={due} onRestore={restore}/>
  <div className="card span-12"><h3 className="card-title">💵 Todos los cobros · últimos 12 meses</h3>
   <div className="form-row fin-filters"><div className="field"><label htmlFor="pf-person">HABITANTE</label><select id="pf-person" value={person} onChange={e=>setPerson(e.target.value)}><option value="todos">Todos</option>{people.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></div><div className="field"><label htmlFor="pf-status">ESTADO</label><select id="pf-status" value={status} onChange={e=>setStatus(e.target.value)}><option value="todos">Todos</option><option value="paid">Pagó</option><option value="pending">Pendiente</option><option value="reported">Avisó que pagó</option><option value="overdue">Vencido</option><option value="cancelled">Anulado</option></select></div></div>
   <div className="fin-totals"><span>Cobrado: <b>{money(totals.cobrado)}</b></span><span>Por cobrar: <b>{money(totals.debe)}</b></span><span>{list.length} cobro{list.length===1?'':'s'}</span></div>
   <div className="table-wrap"><table className="table"><thead><tr><th>HABITANTE</th><th>MES</th><th>MONTO</th><th>ESTADO</th><th>PAGADO EL</th><th>COMPROBANTE</th></tr></thead><tbody>{list.map(p=>{const st=statusOf(p);return <tr key={p.id} className={p.overdue?'row-overdue':''}><td className="cell-head"><b>{p.name}</b>{p.room?<span className="mini muted"> · Hab. {p.room}</span>:null}</td><td data-label="MES"><span className="cap">{monthLabel(p.due_date.slice(0,7))}</span></td><td data-label="MONTO">{money(p.total)}</td><td data-label="ESTADO"><span className={'log-cell '+st.cls}>{st.icon} {st.text}</span></td><td data-label="PAGADO EL">{p.paid_at?new Date(p.paid_at).toLocaleDateString('es-AR'):'—'}</td><td data-label="COMPROBANTE">{p.proof_url?<a className="button blue" href={p.proof_url} target="_blank" rel="noreferrer">Ver</a>:'—'}{p.cancelled&&<button className="button" onClick={()=>restore(p)}>Restaurar</button>}</td></tr>})}</tbody></table></div>
   {!list.length&&<div className="empty">No hay cobros con esos filtros.</div>}
   <p className="mini muted">Para confirmar pagos, avisar o editar montos del mes en curso, usá la sección Alquiler.</p></div>
 </>;
}

// ---------- Otros ingresos ----------
const incomeIcon:Record<string,string>={Depósito:'🏦',Multa:'⚠️',Venta:'🛒',Servicios:'🔌',Otros:'💵'};
function IncomesPanel({api,show,month,onChange}:{api:Api;show:(s:string)=>void;month:string;onChange:()=>Promise<void>}){
 const today=new Date().toLocaleDateString('en-CA');
 const [items,setItems]=useState<{id:string;concept:string;category:string;amount:number;received_on:string;notes:string|null}[]>([]);const [total,setTotal]=useState(0);
 const [form,setForm]=useState({concept:'',category:'Depósito',amount:'',received_on:today,notes:''});
 async function load(){try{const j=await api(`/api/incomes?month=${month}`);setItems(j.items||[]);setTotal(j.total||0)}catch(e){show(errMsg(e))}}
 useEffect(()=>{load()},[month]);
 async function add(){try{await api('/api/incomes',jsonBody('POST',{...form,amount:Number(form.amount)}));show('Ingreso agregado 💵');setForm({...form,concept:'',amount:'',notes:''});await load();await onChange()}catch(e){show(errMsg(e))}}
 async function remove(id:string,concept:string){if(!confirm(`¿Eliminar "${concept}"?`))return;try{await api('/api/incomes',jsonBody('DELETE',{id}));show('Ingreso eliminado');await load();await onChange()}catch(e){show(errMsg(e))}}
 return <>
  <div className="card span-5"><h3 className="card-title">➕ Agregar ingreso</h3><p className="mini muted">Además del alquiler (que se suma solo al confirmar cada pago).</p><div className="form">
   <div className="field"><label htmlFor="in-concept">CONCEPTO</label><input id="in-concept" value={form.concept} onChange={e=>setForm({...form,concept:e.target.value})} placeholder="Ej. Depósito de Juan, multa por ruido"/></div>
   <div className="form-row"><div className="field"><label htmlFor="in-cat">CATEGORÍA</label><select id="in-cat" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{Object.keys(incomeIcon).map(c=><option key={c}>{c}</option>)}</select></div><div className="field"><label htmlFor="in-amount">MONTO</label><input id="in-amount" type="number" min={0} inputMode="decimal" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></div></div>
   <div className="field"><label htmlFor="in-date">FECHA</label><input id="in-date" type="date" value={form.received_on} onChange={e=>setForm({...form,received_on:e.target.value})}/></div>
   <div className="field"><label htmlFor="in-notes">NOTA (opcional)</label><input id="in-notes" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></div>
   <button className="button purple" onClick={add}>AGREGAR INGRESO</button></div></div>
  <div className="card span-7"><h3 className="card-title">💵 Otros ingresos de <span className="cap">{monthLabel(month)}</span></h3><div className="big-number">{money(total)}</div>
   {items.map(x=><div className="notice" key={x.id}><div className="notice-icon">{incomeIcon[x.category]||'💵'}</div><div className="notice-main"><b>{x.concept}</b><div className="mini muted">{dateAR(x.received_on)} · {x.category}{x.notes?` · ${x.notes}`:''}</div></div><b>{money(x.amount)}</b><button className="icon-btn" aria-label={`Eliminar ${x.concept}`} onClick={()=>remove(x.id,x.concept)}>🗑️</button></div>)}
   {!items.length&&<div className="empty">No hay otros ingresos en este mes.</div>}</div>
 </>;
}
