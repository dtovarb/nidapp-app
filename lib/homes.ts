import bcrypt from 'bcryptjs';
import type { requireDb } from '@/lib/db';
import { HttpError } from '@/lib/api';
import { notify } from '@/lib/notify';

type Db = ReturnType<typeof requireDb>;

export const DEFAULT_TASKS = ['Tirar la basura', 'Limpiar el baño'];
export const DEFAULT_RULES = [
  ['🧹','Limpieza','Dejá los espacios comunes limpios después de usarlos. Respetá los turnos y avisá si algo se rompe.'],
  ['🔇','Ruido','Evitemos ruidos fuertes durante la noche. Si necesitás hacer una reunión, avisá con anticipación.'],
  ['🧺','Lavarropas','Respetá la reserva, retirá la ropa al terminar y marcá la reserva como finalizada.'],
  ['🍽️','Cocina','Lavá tus utensilios y no ocupes indefinidamente las superficies comunes.'],
  ['🤝','Respeto','Tratemos a todos con respeto. Los problemas importantes deben comunicarse mediante avisos.'],
  ['🚪','Espacios privados','Respetá habitaciones y pertenencias ajenas. No ingreses a un cuarto sin permiso.'],
  ['🙋','Invitados','Avisá en la sección Invitados quién viene y en qué horario.'],
  ['🗑️','Tareas del mes','Cada mes a cada habitación le toca una tarea. Revisala en Tareas y marcala cuando la hagas.'],
];

export const isEmail = (v: unknown) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
export const normEmail = (v: unknown) => String(v || '').trim().toLowerCase();

// Nombre de usuario interno único (el login nuevo es por email; el usuario queda para cuentas viejas).
export async function uniqueUsername(db: Db, base: string) {
  const slug = (base.split('@')[0] || 'usuario').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '').slice(0, 16) || 'usuario';
  for (let i = 0; i < 6; i++) {
    const candidate = i === 0 ? slug : `${slug}${Math.floor(1000 + Math.random() * 9000)}`;
    const { data } = await db.from('users').select('id').eq('username', candidate).maybeSingle();
    if (!data) return candidate;
  }
  return `${slug}${crypto.randomUUID().slice(0, 6)}`;
}

// Busca la cuenta por email. Si existe, exige la contraseña; si no, la crea.
export async function findOrCreateAccount(db: Db, { name, email, password }: { name: string; email: string; password: string }) {
  const { data: existing } = await db.from('accounts').select('id,password_hash,name').eq('email', email).maybeSingle();
  if (existing) {
    if (!(await bcrypt.compare(password, existing.password_hash))) throw new HttpError(409, 'Ese email ya tiene una cuenta. Usá tu contraseña actual (o recuperala desde el inicio de sesión).');
    return { id: existing.id as string, created: false };
  }
  const { data, error } = await db.from('accounts').insert({ email, name, password_hash: await bcrypt.hash(password, 10) }).select('id').single();
  if (error) { if (error.code === '23505') throw new HttpError(409, 'Ese email ya tiene una cuenta.'); throw error; }
  return { id: data.id as string, created: true };
}

// Crea una residencia nueva con sus habitaciones, tareas y normas base, y al creador como dueño.
export async function createHome(db: Db, accountId: string, opts: { homeName: string; ownerName: string; email: string | null; rooms?: number; price?: number }) {
  const homeName = opts.homeName.trim().slice(0, 60);
  if (!homeName) throw new HttpError(400, 'Poné el nombre de la residencia.');
  const rooms = Math.max(1, Math.min(30, Math.floor(Number(opts.rooms) || 6)));
  const price = Math.max(0, Number(opts.price) || 0);
  const { data: home, error } = await db.from('homes').insert({ name: homeName, rent_due_day: 5, created_by: accountId }).select('id').single();
  if (error) throw error;
  const inserts = await Promise.all([
    db.from('rooms').insert(Array.from({ length: rooms }, (_, i) => ({ home_id: home.id, number: String(i + 1), capacity: 1, price }))),
    db.from('tasks').insert(DEFAULT_TASKS.map((name, position) => ({ home_id: home.id, name, position }))),
    db.from('rules').insert(DEFAULT_RULES.map(([icon, title, body], position) => ({ home_id: home.id, icon, title, body, position }))),
  ]);
  const failed = inserts.find(r => r.error); if (failed?.error) throw failed.error;
  const member = await addMember(db, { accountId, homeId: home.id, name: opts.ownerName, email: opts.email, role: 'owner', room: null });
  return { homeId: home.id as string, memberId: member };
}

export async function addMember(db: Db, m: { accountId: string; homeId: string; name: string; email: string | null; role: 'owner'|'admin'|'resident'; room: string | null }) {
  const { data: already } = await db.from('users').select('id,active').eq('account_id', m.accountId).eq('home_id', m.homeId).maybeSingle();
  if (already?.active) throw new HttpError(409, 'Ya sos parte de esa residencia.');
  if (already) { const { error } = await db.from('users').update({ active: true, role: m.role, room: m.room }).eq('id', already.id); if (error) throw error; return already.id as string; }
  const username = await uniqueUsername(db, m.email || m.name);
  const { data, error } = await db.from('users').insert({ account_id: m.accountId, home_id: m.homeId, username, name: m.name, email: m.email, role: m.role, room: m.room }).select('id').single();
  if (error) throw error;
  return data.id as string;
}

export async function checkRoomSpace(db: Db, homeId: string, room: string, exceptId?: string) {
  const { data: r } = await db.from('rooms').select('number,capacity').eq('home_id', homeId).eq('number', room).maybeSingle();
  if (!r) throw new HttpError(400, 'Esa habitación no existe.');
  let q = db.from('users').select('id', { count: 'exact', head: true }).eq('home_id', homeId).eq('role', 'resident').eq('active', true).eq('room', room);
  if (exceptId) q = q.neq('id', exceptId);
  const { count } = await q;
  if ((count || 0) >= r.capacity) throw new HttpError(400, `La habitación ${room} está completa (cupo: ${r.capacity}).`);
}

// Usa un código de invitación: valida que esté vigente y agrega a la cuenta en esa residencia.
export async function joinWithInvite(db: Db, accountId: string, code: string, name: string, email: string | null) {
  const { data: inv } = await db.from('invites').select('id,home_id,role,room,uses,max_uses,expires_at,active,homes(name)').eq('code', code.trim().toUpperCase()).maybeSingle();
  if (!inv || !inv.active || new Date(inv.expires_at) < new Date() || inv.uses >= inv.max_uses) throw new HttpError(400, 'El código no es válido o ya venció. Pedile uno nuevo al dueño.');
  if (inv.role === 'resident' && inv.room) await checkRoomSpace(db, inv.home_id, inv.room);
  const memberId = await addMember(db, { accountId, homeId: inv.home_id, name, email, role: inv.role, room: inv.role === 'resident' ? inv.room : null });
  await db.from('invites').update({ uses: inv.uses + 1, active: inv.uses + 1 < inv.max_uses }).eq('id', inv.id);
  const { data: managers } = await db.from('users').select('id').eq('home_id', inv.home_id).in('role', ['owner', 'admin']).eq('active', true).neq('id', memberId);
  await notify(db, (managers || []).map(o => ({ home_id: inv.home_id, user_id: o.id, title: '👋 Nueva persona en la residencia', message: `${name} se unió${inv.room ? ` a la habitación ${inv.room}` : ''}${inv.role === 'admin' ? ' como encargado/a' : ''}.${inv.role === 'resident' && !inv.room ? ' Asignale una habitación en Habitantes.' : ''}`, kind: 'general' })));
  return { memberId, homeName: (inv as any).homes?.name as string };
}
