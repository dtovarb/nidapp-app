import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { requireDb } from '@/lib/db';

export type Role = 'owner'|'admin'|'resident';
// Una sesión es una cuenta (persona) trabajando en una residencia: "id" es su membresía en esa residencia.
export type SessionUser = { id: string; account_id: string; username: string; name: string; role: Role; room?: string | null; home_id?: string | null; home_name?: string | null };
const cookieName = 'nidapp_session';

export const isManager = (role?: string | null) => role === 'owner' || role === 'admin';

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) {
    if (process.env.NODE_ENV === 'production') throw new Error('Falta AUTH_SECRET en las variables de entorno.');
    return new TextEncoder().encode('dev-secret-change-me');
  }
  return new TextEncoder().encode(value);
}

export async function setSession(memberId: string, accountId: string) {
  const token = await new SignJWT({ mid: memberId, aid: accountId }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('30d').sign(secret());
  const jar = await cookies();
  jar.set(cookieName, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60*60*24*30 });
}

export async function clearSession() {
  const jar = await cookies(); jar.delete(cookieName);
}

const memberCols = 'id,account_id,username,name,role,room,home_id,active,homes(name)';
const toSession = (m: any): SessionUser => ({ id: m.id, account_id: m.account_id, username: m.username, name: m.name, role: m.role, room: m.room, home_id: m.home_id, home_name: m.homes?.name ?? null });

// Verifica la cookie y vuelve a leer la membresía de la base en cada pedido: si el dueño la desactivó
// o le cambió el rol o la habitación, el cambio aplica enseguida. Si esa membresía ya no está activa,
// usa otra residencia activa de la misma cuenta.
export async function getSession(): Promise<SessionUser|null> {
  const jar = await cookies(); const token = jar.get(cookieName)?.value; if (!token) return null;
  let mid = '', aid = '';
  try { const { payload } = await jwtVerify(token, secret()); mid = String(payload.mid || payload.id || ''); aid = String(payload.aid || ''); } catch { return null; }
  if (!mid) return null;
  const db = requireDb();
  const { data: m } = await db.from('users').select(memberCols).eq('id', mid).maybeSingle();
  const accountId = aid || m?.account_id;
  if (!accountId || (m && m.account_id !== accountId)) return null;
  if (m?.active) return toSession(m);
  const { data: other } = await db.from('users').select(memberCols).eq('account_id', accountId).eq('active', true).order('created_at').limit(1).maybeSingle();
  return other ? toSession(other) : null;
}
