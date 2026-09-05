import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireDb } from '@/lib/db';
import { setSession } from '@/lib/auth';

export async function POST(req: Request){
 try{const {username,password}=await req.json(); if(!username||!password)return NextResponse.json({error:'Completá usuario y contraseña.'},{status:400}); const db=requireDb(); const {data,error}=await db.from('users').select('id,username,name,role,room,password_hash,active').eq('username',String(username).toLowerCase()).eq('active',true).maybeSingle(); if(error)throw error; if(!data||!(await bcrypt.compare(password,data.password_hash)))return NextResponse.json({error:'Usuario o contraseña incorrectos.'},{status:401}); await setSession({id:data.id,username:data.username,name:data.name,role:data.role,room:data.room}); return NextResponse.json({ok:true,user:{id:data.id,username:data.username,name:data.name,role:data.role,room:data.room}});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Error de servidor.'},{status:500});}
}
