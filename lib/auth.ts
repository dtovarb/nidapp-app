import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { requireDb } from '@/lib/db';

export type SessionUser = { id: string; username: string; name: string; role: 'owner'|'resident'; room?: string | null; home_id?: string | null };
const cookieName = 'nidapp_session';

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) {
    if (process.env.NODE_ENV === 'production') throw new Error('Falta AUTH_SECRET en las variables de entorno.');
    return new TextEncoder().encode('dev-secret-change-me');
  }
  return new TextEncoder().encode(value);
}

export async function setSession(user: SessionUser) {
  const token = await new SignJWT({ id: user.id }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('7d').sign(secret());
  const jar = await cookies();
  jar.set(cookieName, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60*60*24*7 });
}

export async function clearSession() {
  const jar = await cookies(); jar.delete(cookieName);
}

// Verifica la cookie y vuelve a leer el usuario de la base: si el dueño lo desactivó
// o le cambió el rol o la habitación, el cambio aplica en el próximo pedido.
export async function getSession(): Promise<SessionUser|null> {
  const jar = await cookies(); const token = jar.get(cookieName)?.value; if (!token) return null;
  let id: string;
  try { const { payload } = await jwtVerify(token, secret()); id = String(payload.id || ''); } catch { return null; }
  if (!id) return null;
  const { data } = await requireDb().from('users').select('id,username,name,role,room,home_id,active').eq('id', id).maybeSingle();
  if (!data || !data.active) return null;
  return { id: data.id, username: data.username, name: data.name, role: data.role, room: data.room, home_id: data.home_id };
}
