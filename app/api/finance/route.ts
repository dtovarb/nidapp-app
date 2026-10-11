import { homeContext, fail, json, HttpError, signedUrl } from '@/lib/api';
import { shiftMonth, todayAR } from '@/lib/rent';

// Finanzas de la residencia (solo dueño o encargado), con criterio de caja:
// - Alquileres cobrados: cuentan en el mes en que el dueño confirmó el pago.
// - Otros ingresos y gastos: en el mes de su fecha.
// Devuelve la serie de los últimos meses para el gráfico y el detalle del mes elegido.
const pad=(n:number)=>String(n).padStart(2,'0');
const key=(y:number,m:number)=>`${y}-${pad(m)}`;
// Inicio de un mes en Argentina (UTC−3) como instante UTC, para comparar con paid_at.
const startAR=(y:number,m:number)=>`${y}-${pad(m)}-01T03:00:00Z`;
const monthOfPaidAt=(iso:string)=>new Date(new Date(iso).getTime()-3*3600e3).toISOString().slice(0,7);

export async function GET(req:Request){try{
  const {db,homeId,s}=await homeContext({ownerOnly:true,ownerMessage:'Solo el dueño puede ver las finanzas.'});
  const url=new URL(req.url);const t=todayAR();
  const month=url.searchParams.get('month')||key(t.y,t.m);if(!/^\d{4}-\d{2}$/.test(month))throw new HttpError(400,'Mes inválido.');
  const span=Math.max(3,Math.min(24,Number(url.searchParams.get('months'))||12));
  const [y,m]=month.split('-').map(Number);const first=shiftMonth(y,m,-(span-1));const after=shiftMonth(y,m,1);
  const fromDate=`${key(first.y,first.m)}-01`,toDate=`${key(after.y,after.m)}-01`;
  const [{data:paid,error:e1},{data:due,error:e2},{data:incomes,error:e3},{data:expenses,error:e4},{data:home}]=await Promise.all([
    db.from('rent_payments').select('id,resident_id,due_date,amount,services_amount,paid,paid_at,proof_path,room,users(name,room)').eq('home_id',homeId).eq('paid',true).eq('cancelled',false).gte('paid_at',startAR(first.y,first.m)).lt('paid_at',startAR(after.y,after.m)),
    db.from('rent_payments').select('id,resident_id,due_date,amount,services_amount,paid,paid_at,cancelled,cancel_reason,reported_at,proof_path,room,users(name,room)').eq('home_id',homeId).gte('due_date',fromDate).lt('due_date',toDate).order('due_date',{ascending:false}),
    db.from('incomes').select('id,concept,category,amount,received_on,notes').eq('home_id',homeId).gte('received_on',fromDate).lt('received_on',toDate).order('received_on',{ascending:false}),
    db.from('expenses').select('id,item,category,quantity,amount,spent_on,notes').eq('home_id',homeId).gte('spent_on',fromDate).lt('spent_on',toDate).order('spent_on',{ascending:false}),
    db.from('homes').select('name').eq('id',homeId).single(),
  ]);
  if(e1||e2||e3||e4)throw (e1||e2||e3||e4);
  const tot=(p:any)=>Number(p.amount)+Number(p.services_amount);
  const months=Array.from({length:span},(_,i)=>{const d=shiftMonth(first.y,first.m,i);return key(d.y,d.m);});
  const series=months.map(k=>{
    const rent=(paid||[]).filter(p=>p.paid_at&&monthOfPaidAt(p.paid_at)===k).reduce((a,p)=>a+tot(p),0);
    const other=(incomes||[]).filter(x=>x.received_on.slice(0,7)===k).reduce((a,x)=>a+Number(x.amount),0);
    const spent=(expenses||[]).filter(x=>x.spent_on.slice(0,7)===k).reduce((a,x)=>a+Number(x.amount),0);
    const pending=(due||[]).filter(p=>p.due_date.slice(0,7)===k&&!p.paid&&!p.cancelled).reduce((a,p)=>a+tot(p),0);
    return {month:k,rent,other,income:rent+other,expenses:spent,profit:rent+other-spent,pending};
  });
  const today=t.iso;
  const payments=await Promise.all((due||[]).map(async(p:any)=>({id:p.id,resident_id:p.resident_id,name:p.users?.name||'Ex habitante',room:p.room||p.users?.room||null,due_date:p.due_date,total:tot(p),paid:p.paid,paid_at:p.paid_at,cancelled:p.cancelled,cancel_reason:p.cancel_reason,reported_at:p.reported_at,overdue:!p.paid&&!p.cancelled&&p.due_date<today,proof_url:await signedUrl(db,p.proof_path)})));
  const inMonth=(d:string)=>d.slice(0,7)===month;
  return json({home:home?.name||s.home_name,month,months,series,payments,
    detail:{collected:(paid||[]).filter(p=>p.paid_at&&monthOfPaidAt(p.paid_at)===month).map((p:any)=>({id:p.id,name:p.users?.name||'Ex habitante',room:p.room||p.users?.room||null,due_date:p.due_date,paid_at:p.paid_at,total:tot(p)})),
      incomes:(incomes||[]).filter(x=>inMonth(x.received_on)).map(x=>({...x,amount:Number(x.amount)})),
      expenses:(expenses||[]).filter(x=>inMonth(x.spent_on)).map(x=>({...x,amount:Number(x.amount)}))}});
}catch(e){return fail(e)}}
