import type { requireDb } from '@/lib/db';
import { currentDue, homeDueDay, monthKey, shiftMonth, syncPayments, todayAR } from '@/lib/rent';
import { notify } from '@/lib/notify';

type Db = ReturnType<typeof requireDb>;
export const ADJUST_LABEL: Record<string,string> = { none:'Sin ajuste', percent:'Porcentaje fijo', ipc:'IPC (inflación)', icl:'ICL (índice de contratos de locación)', other:'Otro índice' };

// Nuevo precio con el ajuste aplicado, redondeado a la centena.
export const adjusted = (price:number, percent:number) => Math.round(price*(1+percent/100)/100)*100;

// Aplica los ajustes programados cuyo mes ya llegó: actualiza el precio de cada habitación,
// guarda los precios de antes y después, recalcula los cobros pendientes del mes y avisa a los habitantes.
export async function applyDueAdjustments(db:Db, homeId:string){
  const t=todayAR();const month=monthKey(t.y,t.m);
  const {data:pending}=await db.from('rent_adjustments').select('id,percent,effective_month,method').eq('home_id',homeId).eq('status','scheduled').lte('effective_month',month).order('effective_month');
  if(!pending?.length) return 0;
  for(const adj of pending){
    const {data:rooms}=await db.from('rooms').select('id,number,price').eq('home_id',homeId);
    const before=(rooms||[]).map(r=>({number:r.number,price:Number(r.price)}));
    const after=before.map(r=>({number:r.number,price:adjusted(r.price,Number(adj.percent))}));
    for(const r of rooms||[]){const p=after.find(a=>a.number===r.number)!.price;if(p!==Number(r.price))await db.from('rooms').update({price:p}).eq('id',r.id);}
    await db.from('rent_adjustments').update({status:'applied',applied_at:new Date().toISOString(),prices_before:before,prices_after:after}).eq('id',adj.id);
    // Próximo ajuste: tantos meses después del que se aplicó.
    const {data:home}=await db.from('homes').select('adjust_type,adjust_every,rent_due_day').eq('id',homeId).single();
    if(home&&home.adjust_type!=='none'){const [y,m]=adj.effective_month.split('-').map(Number);const n=shiftMonth(y,m,home.adjust_every);await db.from('homes').update({next_adjust:`${monthKey(n.y,n.m)}-01`}).eq('id',homeId);}
    await syncPayments(db,homeId,currentDue(home?.rent_due_day||await homeDueDay(db,homeId)));
    const {data:people}=await db.from('users').select('id,room').eq('home_id',homeId).eq('role','resident').eq('active',true);
    const [y,m]=adj.effective_month.split('-').map(Number);const monthName=new Date(y,m-1,1).toLocaleDateString('es-AR',{month:'long',year:'numeric'});
    await notify(db,(people||[]).filter(p=>p.room).map(p=>{const price=after.find(a=>a.number===p.room)?.price;return {home_id:homeId,user_id:p.id,title:'📈 Actualización del alquiler',kind:'rent',message:`Desde ${monthName} el alquiler se actualiza ${Number(adj.percent).toLocaleString('es-AR')}%${price?`: tu alquiler pasa a $${price.toLocaleString('es-AR')} (más servicios)`:''}.`};}));
  }
  return pending.length;
}

// Le recuerda al dueño que toca ajustar el alquiler (una vez por día, desde la fecha de próximo ajuste).
export async function remindAdjustment(db:Db, homeId:string){
  const {data:home}=await db.from('homes').select('adjust_type,adjust_every,adjust_percent,next_adjust').eq('id',homeId).single();
  if(!home||home.adjust_type==='none'||!home.next_adjust||home.next_adjust>todayAR().iso) return;
  const {data:scheduled}=await db.from('rent_adjustments').select('id').eq('home_id',homeId).eq('status','scheduled').limit(1);
  if(scheduled?.length) return;
  const {data:managers}=await db.from('users').select('id').eq('home_id',homeId).in('role',['owner','admin']).eq('active',true);
  const since=new Date(Date.now()-20*3600e3).toISOString();
  const {data:recent}=await db.from('notifications').select('user_id').in('user_id',(managers||[]).map(m=>m.id)).eq('title','📈 Toca ajustar el alquiler').gte('created_at',since);
  const skip=new Set((recent||[]).map(r=>r.user_id));
  await notify(db,(managers||[]).filter(m=>!skip.has(m.id)).map(m=>({home_id:homeId,user_id:m.id,title:'📈 Toca ajustar el alquiler',kind:'rent',message:`Según tu configuración (${ADJUST_LABEL[home.adjust_type]}, cada ${home.adjust_every} meses) toca actualizar el alquiler. Hacelo desde Alquiler → Configuración del alquiler.`})));
}
