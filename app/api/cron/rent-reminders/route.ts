import { NextResponse } from 'next/server';
import { requireDb } from '@/lib/db';

function daysBetween(a: Date,b: Date){return Math.ceil((b.getTime()-a.getTime())/(1000*60*60*24));}

export async function GET(req:Request){
  const auth=req.headers.get('authorization');
  const expected=`Bearer ${process.env.CRON_SECRET||''}`;
  if(!process.env.CRON_SECRET || auth!==expected) return NextResponse.json({error:'Unauthorized'},{status:401});
  try{
    const db=requireDb();
    const today=new Date(); today.setHours(0,0,0,0);
    const {data:homes,error:homesError}=await db.from('homes').select('id,rent_due_day'); if(homesError)throw homesError;
    let created=0;
    for(const home of homes||[]){
      const due=new Date(today.getFullYear(),today.getMonth(),home.rent_due_day);
      if(due<today) due.setMonth(due.getMonth()+1);
      const days=daysBetween(today,due);
      if(days<0 || days>3) continue;
      const dueStr=due.toISOString().slice(0,10);
      const {data:payments,error}=await db.from('rent_payments').select('id,resident_id,amount,paid').eq('home_id',home.id).eq('due_date',dueStr).eq('paid',false);
      if(error)throw error;
      for(const p of payments||[]){
        const message=`Recordatorio: tu alquiler vence el ${dueStr}. Monto: $${Number(p.amount).toLocaleString('es-AR')}.`;
        const {data:existing,error:findError}=await db.from('notifications').select('id').eq('user_id',p.resident_id).ilike('message',`%vence el ${dueStr}%`).limit(1);
        if(findError)throw findError;
        if(!existing?.length){
          const {error:insertError}=await db.from('notifications').insert({home_id:home.id,user_id:p.resident_id,title:'Recordatorio de alquiler',message,kind:'rent'});
          if(insertError)throw insertError; created++;
        }
      }
    }
    return NextResponse.json({ok:true,created});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Error'},{status:500});}
}
