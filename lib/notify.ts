import webpush from 'web-push';
import type { requireDb } from '@/lib/db';
import { VAPID_PUBLIC_KEY, VAPID_SUBJECT } from '@/lib/push-config';

type Db = ReturnType<typeof requireDb>;
type Row = { home_id: string; user_id: string; title: string; message: string; kind?: string };

const publicKey = VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const pushEnabled = Boolean(publicKey && privateKey);
if (pushEnabled) webpush.setVapidDetails(VAPID_SUBJECT, publicKey, privateKey!);

// Guarda las notificaciones internas y, si las claves VAPID están configuradas, las manda
// como push al celular de cada persona. Un fallo de push nunca rompe la acción principal.
export async function notify(db: Db, rows: Row[]) {
  if (!rows.length) return;
  const { error } = await db.from('notifications').insert(rows.map(r => ({ kind: 'general', ...r })));
  if (error) throw error;
  if (!pushEnabled) return;
  try { await sendPush(db, rows); } catch (e) { console.error('push', e); }
}

async function sendPush(db: Db, rows: Row[]) {
  const { data: members } = await db.from('users').select('id,account_id,homes(name)').in('id', [...new Set(rows.map(r => r.user_id))]);
  const byMember = new Map((members || []).map((m: any) => [m.id, m]));
  const accountIds = [...new Set((members || []).map((m: any) => m.account_id).filter(Boolean))];
  if (!accountIds.length) return;
  const { data: subs } = await db.from('push_subscriptions').select('id,account_id,endpoint,p256dh,auth').in('account_id', accountIds);
  const dead: string[] = [];
  await Promise.allSettled(rows.flatMap(r => {
    const m: any = byMember.get(r.user_id); if (!m) return [];
    const payload = JSON.stringify({ title: r.title, body: r.message, home: m.homes?.name || '', url: `/dashboard?s=notificaciones&m=${m.id}`, tag: r.kind || 'general' });
    return (subs || []).filter(s => s.account_id === m.account_id).map(s =>
      webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24 })
        .catch((e: any) => { if (e?.statusCode === 404 || e?.statusCode === 410) dead.push(s.id); }));
  }));
  if (dead.length) await db.from('push_subscriptions').delete().in('id', dead);
}
