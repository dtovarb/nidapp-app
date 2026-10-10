import { NextResponse } from 'next/server';
import { getSession, type SessionUser } from '@/lib/auth';
import { requireDb } from '@/lib/db';

export class HttpError extends Error { constructor(public status:number, message:string){ super(message); } }

// Sesión + base + residencia. Con ownerOnly corta con 403 si no es el dueño.
export async function homeContext(opts:{ownerOnly?:boolean; ownerMessage?:string}={}){
  const s=await getSession(); if(!s) throw new HttpError(401,'No autenticado');
  if(opts.ownerOnly&&s.role!=='owner') throw new HttpError(403,opts.ownerMessage||'Solo el dueño puede hacer esto.');
  if(!s.home_id) throw new HttpError(400,'No se encontró la residencia.');
  return { s: s as SessionUser & {home_id:string}, db: requireDb(), homeId: s.home_id };
}

// Respuesta de error uniforme: los errores esperados muestran su mensaje; los inesperados
// se registran en el servidor y no exponen detalles internos de la base.
export function fail(e:unknown){
  if(e instanceof HttpError) return NextResponse.json({error:e.message},{status:e.status});
  console.error(e);
  return NextResponse.json({error:'Error de servidor. Probá de nuevo.'},{status:500});
}

export const json=NextResponse.json;

// Valida que una ruta de archivo subida pertenezca al usuario y al tipo esperado.
export function ownsPath(path:unknown, kind:'photo'|'proof'|'guest', userId:string){
  return typeof path==='string' && path.startsWith(`${kind}/${userId}/`) && !path.includes('..');
}

export async function signedUrl(db:ReturnType<typeof requireDb>, path:string|null|undefined){
  if(!path) return null;
  const {data}=await db.storage.from('nidapp-files').createSignedUrl(path,3600);
  return data?.signedUrl||null;
}

export async function notifyUsers(db:ReturnType<typeof requireDb>, homeId:string, userIds:string[], title:string, message:string, kind='general'){
  if(!userIds.length) return;
  const {error}=await db.from('notifications').insert(userIds.map(user_id=>({home_id:homeId,user_id,title,message,kind})));
  if(error) throw error;
}

export function isTime(v:unknown){ return typeof v==='string' && /^\d{2}:\d{2}(:\d{2})?$/.test(v); }
export function isDate(v:unknown){ return typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v); }
