import type { requireDb } from '@/lib/db';

type Db = ReturnType<typeof requireDb>;
const TZ = 'America/Argentina/Buenos_Aires';

// Fecha de hoy en Argentina como {y, m (1-12), d}, sin depender de la zona horaria del servidor.
export function todayAR(){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
  return {y:Number(parts.year),m:Number(parts.month),d:Number(parts.day),iso:`${parts.year}-${parts.month}-${parts.day}`};
}
const pad=(n:number)=>String(n).padStart(2,'0');
export function monthKey(y:number,m:number){ return `${y}-${pad(m)}`; }
export function shiftMonth(y:number,m:number,delta:number){ const t=y*12+(m-1)+delta; return {y:Math.floor(t/12),m:(t%12)+1}; }

// Vencimiento del mes en curso. Cada mes tiene su propio registro de pago,
// así un mes impago queda como deuda en vez de desaparecer al pasar la fecha.
export function currentDue(rentDueDay:number){ const t=todayAR(); return `${t.y}-${pad(t.m)}-${pad(rentDueDay)}`; }

// Crea el pago del período para cada habitante activo y actualiza los que siguen impagos
// (por si cambió el precio de la habitación, los servicios o la habitación del habitante).
export async function syncPayments(db:Db, homeId:string, due:string){
  const [{data:residents,error:e1},{data:rooms,error:e2},{data:charges,error:e3},{data:existing,error:e4}]=await Promise.all([
    db.from('users').select('id,room').eq('home_id',homeId).eq('role','resident').eq('active',true),
    db.from('rooms').select('number,price').eq('home_id',homeId),
    db.from('extra_charges').select('name,amount').eq('home_id',homeId).eq('active',true).order('created_at'),
    db.from('rent_payments').select('id,resident_id,amount,services_amount,room,paid,manual,cancelled').eq('home_id',homeId).eq('due_date',due),
  ]);
  if(e1||e2||e3||e4) throw (e1||e2||e3||e4);
  const priceByRoom=new Map((rooms||[]).map(r=>[r.number,Number(r.price)]));
  const detail=(charges||[]).map(c=>({name:c.name,amount:Number(c.amount)}));
  const services=detail.reduce((a,c)=>a+c.amount,0);
  const byResident=new Map((existing||[]).map(p=>[p.resident_id,p]));
  const inserts:any[]=[];
  for(const r of residents||[]){
    const price=r.room?priceByRoom.get(r.room)??0:0;
    // El precio de la habitación es por persona: cada habitante paga el precio completo, aunque la compartan.
    const amount=price;
    const row={home_id:homeId,resident_id:r.id,due_date:due,amount,room:r.room,services_amount:services,services_detail:detail};
    const p=byResident.get(r.id);
    if(!p){ inserts.push(row); continue; }
    // Los pagos editados a mano o anulados por el dueño no se recalculan.
    if(!p.paid&&!p.manual&&!p.cancelled&&(Number(p.amount)!==amount||Number(p.services_amount)!==services||p.room!==r.room)){
      const {error}=await db.from('rent_payments').update({amount,room:r.room,services_amount:services,services_detail:detail}).eq('id',p.id);
      if(error) throw error;
    }
  }
  if(inserts.length){ const {error}=await db.from('rent_payments').upsert(inserts,{onConflict:'home_id,resident_id,due_date',ignoreDuplicates:true}); if(error) throw error; }
}

export async function homeDueDay(db:Db, homeId:string){
  const {data}=await db.from('homes').select('rent_due_day').eq('id',homeId).single();
  return data?.rent_due_day||5;
}

// Avisa a cada habitante que tiene el alquiler pendiente (del mes o de meses anteriores).
// No repite el aviso a quien ya lo recibió en las últimas 12 horas. Devuelve a cuántos les llegó.
export async function remindPending(db:Db, homeId:string, opts:{startOfMonth?:boolean}={}){
  const due=currentDue(await homeDueDay(db,homeId));await syncPayments(db,homeId,due);
  const {data:pending,error}=await db.from('rent_payments').select('resident_id,due_date,amount,services_amount,users!inner(active)').eq('home_id',homeId).eq('paid',false).eq('cancelled',false).lte('due_date',due).eq('users.active',true);
  if(error) throw error;
  const byResident=new Map<string,{total:number;months:number;oldest:string}>();
  for(const p of pending||[]){const cur=byResident.get(p.resident_id)||{total:0,months:0,oldest:p.due_date};cur.total+=Number(p.amount)+Number(p.services_amount);cur.months++;if(p.due_date<cur.oldest)cur.oldest=p.due_date;byResident.set(p.resident_id,cur);}
  if(!byResident.size) return 0;
  const since=new Date(Date.now()-12*60*60*1000).toISOString();
  const {data:recent}=await db.from('notifications').select('user_id').in('user_id',[...byResident.keys()]).eq('kind','rent').eq('title','💰 Alquiler pendiente').gte('created_at',since);
  const skip=new Set((recent||[]).map(r=>r.user_id));
  const [,m,d]=due.split('-');
  const rows=[...byResident.entries()].filter(([id])=>!skip.has(id)).map(([user_id,info])=>({home_id:homeId,user_id,title:'💰 Alquiler pendiente',kind:'rent',
    message:(opts.startOfMonth?'¡Arrancó el mes! ':'')+`Tenés ${info.months>1?`${info.months} pagos pendientes`:'el alquiler pendiente'} por $${info.total.toLocaleString('es-AR')}. Vence el ${Number(d)}/${Number(m)}. Si ya pagaste, avisá desde Alquiler → "Ya pagué".`}));
  const { notify } = await import('@/lib/notify');
  await notify(db,rows);
  return rows.length;
}
