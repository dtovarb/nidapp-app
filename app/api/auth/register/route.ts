import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireDb } from '@/lib/db';
import { setSession } from '@/lib/auth';

export async function POST(req: Request){
 try{const body=await req.json(); const name=String(body.name||'').trim(); const username=String(body.username||'').trim().toLowerCase(); const password=String(body.password||''); const role='resident'; const room=String(body.room||'').trim()||null; const homeName=String(body.homeName||'Casa NIDAPP').trim(); if(!name||!username||password.length<6)return NextResponse.json({error:'Nombre, usuario y una contraseña de 6+ caracteres son obligatorios.'},{status:400}); const db=requireDb(); let {data:home}=await db.from('homes').select('id').eq('name',homeName).maybeSingle(); if(!home){const created=await db.from('homes').insert({name:homeName,rent_due_day:5}).select('id').single(); if(created.error)throw created.error; home=created.data;} const password_hash=await bcrypt.hash(password,10); const created=await db.from('users').insert({home_id:home.id,username,name,password_hash,role,room}).select('id,username,name,role,room').single(); if(created.error){if(created.error.code==='23505')return NextResponse.json({error:'Ese usuario ya existe.'},{status:409});throw created.error;} await setSession({id:created.data.id,username:created.data.username,name:created.data.name,role:created.data.role,room:created.data.room}); return NextResponse.json({ok:true,user:created.data});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Error de servidor.'},{status:500});}
}
