import { isManager } from '@/lib/auth';
import { homeContext, fail, json, HttpError } from '@/lib/api';

// Datos del recibo de un pago confirmado. El dueño ve los de su residencia; el habitante, solo los suyos.
export async function GET(req:Request){try{const {s,db,homeId}=await homeContext();const id=new URL(req.url).searchParams.get('id')||'';
  const {data:p}=await db.from('rent_payments').select('id,resident_id,due_date,amount,services_amount,services_detail,room,paid,paid_at,cancelled,created_at,users(name,email,phone)').eq('id',id).eq('home_id',homeId).maybeSingle();
  if(!p||p.cancelled)throw new HttpError(404,'Recibo no encontrado.');
  if(!isManager(s.role)&&p.resident_id!==s.id)throw new HttpError(403,'No autorizado.');
  if(!p.paid)throw new HttpError(400,'El recibo está disponible cuando el dueño confirma el pago.');
  const [{data:home},{data:owner}]=await Promise.all([db.from('homes').select('name,address').eq('id',homeId).single(),db.from('users').select('name,email,phone').eq('home_id',homeId).eq('role','owner').eq('active',true).order('created_at').limit(1).maybeSingle()]);
  const number=`${p.due_date.slice(0,7).replace('-','')}-${p.id.slice(0,6).toUpperCase()}`;
  return json({number,home:home?.name,address:home?.address||null,owner:owner?.name||null,owner_email:owner?.email||null,resident:(p as any).users?.name||'Habitante',room:p.room,due_date:p.due_date,paid_at:p.paid_at,amount:Number(p.amount),services_amount:Number(p.services_amount),services_detail:p.services_detail||[],total:Number(p.amount)+Number(p.services_amount)});
}catch(e){return fail(e)}}
