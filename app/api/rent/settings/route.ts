import { homeContext, fail, json, HttpError, isDate } from '@/lib/api';
import { currentDue, monthKey, shiftMonth, syncPayments, todayAR } from '@/lib/rent';
import { applyDueAdjustments, adjusted } from '@/lib/adjust';

// Configuración del alquiler de la residencia (solo dueño o encargado):
// día de vencimiento, tipo de ajuste y su frecuencia, y el historial de ajustes.
const owner={ownerOnly:true,ownerMessage:'Solo el dueño puede configurar el alquiler.'};
const TYPES=['none','percent','ipc','icl','other'];

export async function GET(){try{const {db,homeId}=await homeContext(owner);
  const [{data:home,error},{data:history},{data:rooms}]=await Promise.all([
    db.from('homes').select('rent_due_day,adjust_type,adjust_every,adjust_percent,next_adjust').eq('id',homeId).single(),
    db.from('rent_adjustments').select('id,effective_month,percent,method,note,status,prices_before,prices_after,created_at,applied_at').eq('home_id',homeId).neq('status','cancelled').order('effective_month',{ascending:false}).limit(24),
    db.from('rooms').select('number,price').eq('home_id',homeId),
  ]);if(error)throw error;
  return json({...home,adjust_percent:home.adjust_percent!==null?Number(home.adjust_percent):null,history:history||[],rooms:(rooms||[]).map(r=>({number:r.number,price:Number(r.price)})).sort((a,b)=>a.number.localeCompare(b.number,'es',{numeric:true}))});
}catch(e){return fail(e)}}

export async function PATCH(req:Request){try{const {db,homeId}=await homeContext(owner);const b=await req.json();const changes:any={};
  if(b.adjust_type!==undefined){if(!TYPES.includes(b.adjust_type))throw new HttpError(400,'Tipo de ajuste inválido.');changes.adjust_type=b.adjust_type;}
  if(b.adjust_every!==undefined){const n=Number(b.adjust_every);if(!Number.isInteger(n)||n<1||n>24)throw new HttpError(400,'La frecuencia debe ser entre 1 y 24 meses.');changes.adjust_every=n;}
  if(b.adjust_percent!==undefined){const p=b.adjust_percent===null||b.adjust_percent===''?null:Number(b.adjust_percent);if(p!==null&&(!Number.isFinite(p)||p<=-50||p>500))throw new HttpError(400,'Porcentaje inválido.');changes.adjust_percent=p;}
  if(b.next_adjust!==undefined){if(b.next_adjust&&!isDate(b.next_adjust))throw new HttpError(400,'Fecha inválida.');changes.next_adjust=b.next_adjust||null;}
  let moved=0;
  if(b.rent_due_day!==undefined){const d=Number(b.rent_due_day);if(!Number.isInteger(d)||d<1||d>28)throw new HttpError(400,'El día de vencimiento debe ser entre 1 y 28.');changes.rent_due_day=d;
    // Los cobros de este mes en adelante pasan al nuevo día; los meses anteriores no se tocan.
    const t=todayAR();const from=`${monthKey(t.y,t.m)}-01`;
    const {data:rows}=await db.from('rent_payments').select('id,due_date').eq('home_id',homeId).gte('due_date',from);
    for(const r of rows||[]){const nd=`${r.due_date.slice(0,8)}${String(d).padStart(2,'0')}`;if(nd!==r.due_date){const {error}=await db.from('rent_payments').update({due_date:nd}).eq('id',r.id);if(error)throw error;moved++;}}
  }
  if(!Object.keys(changes).length)throw new HttpError(400,'No hay cambios para guardar.');
  const {error}=await db.from('homes').update(changes).eq('id',homeId);if(error)throw error;
  if(changes.rent_due_day)await syncPayments(db,homeId,currentDue(changes.rent_due_day));
  return json({ok:true,moved});
}catch(e){return fail(e)}}

// Programa un ajuste: desde este mes (se aplica ya) o desde el mes que viene (se aplica solo el día 1).
export async function POST(req:Request){try{const {db,homeId}=await homeContext(owner);const b=await req.json();
  const percent=Number(b.percent);if(!Number.isFinite(percent)||percent===0||percent<=-50||percent>500)throw new HttpError(400,'Poné el porcentaje del ajuste (por ejemplo 12,5).');
  const t=todayAR();const eff=b.effective==='next'?shiftMonth(t.y,t.m,1):{y:t.y,m:t.m};const effective_month=monthKey(eff.y,eff.m);
  const {data:dup}=await db.from('rent_adjustments').select('id').eq('home_id',homeId).eq('effective_month',effective_month).eq('status','scheduled').maybeSingle();if(dup)throw new HttpError(409,'Ya hay un ajuste programado para ese mes. Cancelalo primero.');
  const {data:rooms}=await db.from('rooms').select('number,price').eq('home_id',homeId);
  const {error}=await db.from('rent_adjustments').insert({home_id:homeId,effective_month,percent,method:TYPES.includes(b.method)?b.method:'other',note:String(b.note||'').trim().slice(0,200)||null,prices_before:(rooms||[]).map(r=>({number:r.number,price:Number(r.price)})),prices_after:(rooms||[]).map(r=>({number:r.number,price:adjusted(Number(r.price),percent)}))});
  if(error)throw error;
  const applied=await applyDueAdjustments(db,homeId);
  return json({ok:true,applied:applied>0,effective_month});
}catch(e){return fail(e)}}

export async function DELETE(req:Request){try{const {db,homeId}=await homeContext(owner);const b=await req.json();const {data,error}=await db.from('rent_adjustments').update({status:'cancelled'}).eq('id',b.id).eq('home_id',homeId).eq('status','scheduled').select('id').maybeSingle();if(error)throw error;if(!data)throw new HttpError(400,'Solo se pueden cancelar ajustes que todavía no se aplicaron.');return json({ok:true});}catch(e){return fail(e)}}
