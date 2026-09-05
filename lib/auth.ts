import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';

export type SessionUser = { id: string; username: string; name: string; role: 'owner'|'resident'; room?: string | null };
const cookieName = 'nidapp_session';

function secret() { return new TextEncoder().encode(process.env.AUTH_SECRET || 'dev-secret-change-me'); }

export async function setSession(user: SessionUser) {
  const token = await new SignJWT(user).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('7d').sign(secret());
  const jar = await cookies();
  jar.set(cookieName, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60*60*24*7 });
}

export async function clearSession() {
  const jar = await cookies(); jar.delete(cookieName);
}

export async function getSession(): Promise<SessionUser|null> {
  const jar = await cookies(); const token = jar.get(cookieName)?.value; if (!token) return null;
  try { const { payload } = await jwtVerify(token, secret()); return payload as unknown as SessionUser; } catch { return null; }
}
