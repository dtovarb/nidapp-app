import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireDb } from '@/lib/db';
import { setSession } from '@/lib/auth';

const MAX_FAILS=5, WINDOW_MIN=15;

export async function POST(req: Request){
 try{const {username,password}=await req.json(); if(!username||!password)return NextResponse.json({error:'Completá usuario y contraseña.'},{status:400}); const db=requireDb(); const name=String(username).trim().toLowerCase(); const since=new Date(Date.now()-WINDOW_MIN*60*1000).toISOString(); const {count}=await db.from('login_attempts').select('id',{count:'exact',head:true}).eq('username',name).gte('attempted_at',since); if((count||0)>=MAX_FAILS)return NextResponse.json({error:`Demasiados intentos. Probá de nuevo en ${WINDOW_MIN} minutos.`},{status:429}); const {data,error}=await db.from('users').select('id,username,name,role,room,password_hash,active').eq('username',name).eq('active',true).maybeSingle(); if(error)throw error; if(!data||!(await bcrypt.compare(String(password),data.password_hash))){await db.from('login_attempts').insert({username:name});return NextResponse.json({error:'Usuario o contraseña incorrectos.'},{status:401});} await db.from('login_attempts').delete().eq('username',name); await setSession({id:data.id,username:data.username,name:data.name,role:data.role,room:data.room}); return NextResponse.json({ok:true,user:{id:data.id,username:data.username,name:data.name,role:data.role,room:data.room}});}catch(e){console.error(e);return NextResponse.json({error:'Error de servidor.'},{status:500});}
}
