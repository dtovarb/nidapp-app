import { isManager } from '@/lib/auth';
import { homeContext, fail, json, ownsPath, signedUrl, HttpError, notifyUsers } from '@/lib/api'; import { currentDue, homeDueDay, syncPayments, todayAR, shiftMonth } from '@/lib/rent';
const cols='id,resident_id,due_date,amount,services_amount,services_detail,room,paid,paid_at,manual,reported_at,proof_path,proof_uploaded_at,cancelled,cancel_reason,cancelled_at';
const HISTORY_MONTHS=6;
const total=(p:any)=>Number(p.amount)+Number(p.services_amount);

// Devuelve los pagos del mes, las deudas de meses anteriores y el historial de los últimos 6 meses
// (incluidos los pagados y los anulados, para que el registro nunca se pierda).
export async function GET(){try{const {s,db,homeId}=await homeContext();const manager=isManager(s.role);const due=currentDue(await homeDueDay(db,homeId));await syncPayments(db,homeId,due);const today=todayAR().iso;
  const [y,m,d]=due.split('-').map(Number);const first=shiftMonth(y,m,-(HISTORY_MONTHS-1));const historyFrom=`${first.y}-${String(first.m).padStart(2,'0')}-01`;
  let q=db.from('rent_payments').select(manager?cols+',users(name,username,room,email,active)':cols).eq('home_id',homeId).or(`due_date.gte.${historyFrom},and(paid.eq.false,cancelled.eq.false)`).lte('due_date',due).order('due_date',{ascending:false}).order('paid');
  if(!manager)q=q.eq('resident_id',s.id);
  const {data,error}=await q;if(error)throw error;
  const all=await Promise.all(((data||[]) as any[]).map(async p=>({...p,total:total(p),overdue:!p.paid&&!p.cancelled&&p.due_date<today,proof_url:await signedUrl(db,p.proof_path)})));
  const items=all.filter(p=>!p.cancelled&&(p.due_date===due||!p.paid));
  const current=items.filter(p=>p.due_date===due),previous=items.filter(p=>p.due_date<due);
  const sum=(l:any[])=>l.reduce((a,p)=>a+p.total,0);
  const nx=shiftMonth(y,m,1);const next_due=due<today?`${nx.y}-${String(nx.m).padStart(2,'0')}-${String(d).padStart(2,'0')}`:due;
  return json({due_date:due,next_due,items,history:all.filter(p=>p.due_date>=historyFrom),history_from:historyFrom,paid_total:sum(current.filter(p=>p.paid)),pending_total:sum(current.filter(p=>!p.paid)),overdue_total:sum(previous),can_manage:manager});
}catch(e){return fail(e)}}

export async function PATCH(req:Request){try{const {s,db,homeId}=await homeContext();const b=await req.json();
  const {data:p}=await db.from('rent_payments').select('resident_id,due_date,amount,services_amount,paid,cancelled').eq('id',b.id).eq('home_id',homeId).maybeSingle();if(!p)throw new HttpError(404,'Pago no encontrado.');
  if(isManager(s.role)){
    // Restaurar un cobro anulado: vuelve a figurar como pendiente (o pagado, si lo estaba).
    if(b.restore){const {data,error}=await db.from('rent_payments').update({cancelled:false,cancel_reason:null,cancelled_at:null}).eq('id',b.id).select().single();if(error)throw error;return json({item:data});}
    if(p.cancelled)throw new HttpError(400,'Ese cobro está anulado. Restauralo primero.');
    const changes:any={};if(b.paid!==undefined){changes.paid=Boolean(b.paid);changes.paid_at=b.paid?new Date().toISOString():null;}if(b.amount!==undefined||b.services_amount!==undefined){const amount=Number(b.amount),services=Number(b.services_amount);if(!Number.isFinite(amount)||amount<0||!Number.isFinite(services)||services<0)throw new HttpError(400,'Montos inválidos.');changes.amount=amount;changes.services_amount=services;changes.services_detail=services?[{name:'Servicios (editado)',amount:services}]:[];changes.manual=true;}if(b.manual===false){changes.manual=false;}if(!Object.keys(changes).length)throw new HttpError(400,'No hay cambios para guardar.');const {data,error}=await db.from('rent_payments').update(changes).eq('id',b.id).select().single();if(error)throw error;if(changes.manual===false)await syncPayments(db,homeId,p.due_date);
    if(changes.paid===true&&!p.paid){const [yy,mm,dd]=p.due_date.split('-');await notifyUsers(db,homeId,[p.resident_id],'✅ Pago confirmado',`El dueño confirmó tu pago con vencimiento ${dd}/${mm}/${yy}.`,'rent');}
    return json({item:data});
  }
  if(p.resident_id!==s.id||p.cancelled)throw new HttpError(403,'No autorizado.');const {data:owners}=await db.from('users').select('id').eq('home_id',homeId).in('role',['owner','admin']).eq('active',true);const ownerIds=(owners||[]).map(o=>o.id);
  // El habitante avisa que ya pagó: le llega una notificación al dueño, que después confirma el pago.
  if(b.report){if(p.paid)throw new HttpError(400,'Este pago ya está confirmado.');const {data,error}=await db.from('rent_payments').update({reported_at:new Date().toISOString()}).eq('id',b.id).select().single();if(error)throw error;const [yy,mm,dd]=p.due_date.split('-');await notifyUsers(db,homeId,ownerIds,'💸 Aviso de pago',`${s.name} avisa que pagó el alquiler con vencimiento ${dd}/${mm}/${yy} (total $${total(p).toLocaleString('es-AR')}). Revisalo y confirmá el pago.`,'rent');return json({item:data});}
  if(!ownsPath(b.proof_path,'proof',s.id))throw new HttpError(400,'Comprobante inválido.');const {data,error}=await db.from('rent_payments').update({proof_path:b.proof_path,proof_uploaded_at:new Date().toISOString()}).eq('id',b.id).select().single();if(error)throw error;await notifyUsers(db,homeId,ownerIds,'📎 Nuevo comprobante',`${s.name} subió un comprobante de pago.`,'rent');return json({item:data});
}catch(e){return fail(e)}}

// Anula un cobro (por ejemplo, si se cargó por error). No se borra: queda en el registro como
// "anulado", con el motivo, y se puede restaurar.
export async function DELETE(req:Request){try{const {db,homeId}=await homeContext({ownerOnly:true,ownerMessage:'Solo el dueño puede anular cobros.'});const b=await req.json();const reason=String(b.reason||'').trim().slice(0,140)||null;const {data,error}=await db.from('rent_payments').update({cancelled:true,cancel_reason:reason,cancelled_at:new Date().toISOString()}).eq('id',b.id).eq('home_id',homeId).select('id').maybeSingle();if(error)throw error;if(!data)throw new HttpError(404,'Pago no encontrado.');return json({ok:true});}catch(e){return fail(e)}}
