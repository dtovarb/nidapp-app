import { NextResponse } from 'next/server';
import { requireDb } from '@/lib/db';
import { currentDue, remindPending, syncPayments, todayAR } from '@/lib/rent';
import { ensureCurrent } from '@/lib/tasks';
import { notify } from '@/lib/notify';

// Corre una vez por día (vercel.json): crea los pagos del mes, las tareas de la semana o del mes, y avisa del vencimiento.
export async function GET(req:Request){
  const auth=req.headers.get('authorization');
  if(!process.env.CRON_SECRET || auth!==`Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({error:'Unauthorized'},{status:401});
  try{
    const db=requireDb(); const today=todayAR();
    const {data:homes,error:homesError}=await db.from('homes').select('id,rent_due_day'); if(homesError)throw homesError;
    let created=0;
    // Limpieza: las notificaciones leídas de más de 60 días se borran para no acumular espacio.
    await db.from('notifications').delete().eq('read',true).lt('created_at',new Date(Date.now()-60*864e5).toISOString());
    for(const home of homes||[]){
      await ensureCurrent(db,home.id);
      const dueStr=currentDue(home.rent_due_day); await syncPayments(db,home.id,dueStr);
      // El día 1 de cada mes se avisa a todos los que tienen el alquiler pendiente.
      if(today.d===1){created+=await remindPending(db,home.id,{startOfMonth:true});continue;}
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
        await notify(db,[{home_id:home.id,user_id:p.resident_id,title:'Recordatorio de alquiler',message:`Recordatorio: tu alquiler vence el ${d}/${m}/${y}. Total: $${total.toLocaleString('es-AR')}.`,kind:'rent'}]);
        created++;
      }
    }
    return NextResponse.json({ok:true,created});
  }catch(e){console.error(e);return NextResponse.json({error:'Error de servidor.'},{status:500});}
}
