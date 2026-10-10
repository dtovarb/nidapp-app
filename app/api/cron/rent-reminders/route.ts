import { NextResponse } from 'next/server';
import { requireDb } from '@/lib/db';
import { currentDue, syncPayments, todayAR } from '@/lib/rent';
import { ensureAssignments } from '@/lib/tasks';

// Corre una vez por día (vercel.json): crea los pagos y las tareas del mes y avisa del vencimiento.
export async function GET(req:Request){
  const auth=req.headers.get('authorization');
  if(!process.env.CRON_SECRET || auth!==`Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({error:'Unauthorized'},{status:401});
  try{
    const db=requireDb(); const today=todayAR();
    const {data:homes,error:homesError}=await db.from('homes').select('id,rent_due_day'); if(homesError)throw homesError;
    let created=0;
    for(const home of homes||[]){
      await ensureAssignments(db,home.id,today.y,today.m);
      const dueStr=currentDue(home.rent_due_day); await syncPayments(db,home.id,dueStr);
      const days=home.rent_due_day-today.d;
      if(days<0 || days>3) continue;
      const {data:payments,error}=await db.from('rent_payments').select('id,resident_id,amount,services_amount').eq('home_id',home.id).eq('due_date',dueStr).eq('paid',false).eq('cancelled',false);
      if(error)throw error;
      const [y,m,d]=dueStr.split('-');
      for(const p of payments||[]){
        const {data:existing,error:findError}=await db.from('notifications').select('id').eq('user_id',p.resident_id).eq('kind','rent').ilike('message',`%vence el ${d}/${m}/${y}%`).limit(1);
        if(findError)throw findError;
        if(existing?.length) continue;
        const total=Number(p.amount)+Number(p.services_amount);
        const {error:insertError}=await db.from('notifications').insert({home_id:home.id,user_id:p.resident_id,title:'Recordatorio de alquiler',message:`Recordatorio: tu alquiler vence el ${d}/${m}/${y}. Total: $${total.toLocaleString('es-AR')}.`,kind:'rent'});
        if(insertError)throw insertError; created++;
      }
    }
    return NextResponse.json({ok:true,created});
  }catch(e){console.error(e);return NextResponse.json({error:'Error de servidor.'},{status:500});}
}
