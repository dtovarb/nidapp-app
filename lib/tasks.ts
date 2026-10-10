import type { requireDb } from '@/lib/db';
import { todayAR } from '@/lib/rent';
import { notify } from '@/lib/notify';

type Db = ReturnType<typeof requireDb>;
export type Task = { id: string; name: string; position: number; frequency: 'weekly'|'monthly'; assign_by: 'room'|'person'; bathroom_id: string|null };
export type Candidate = { room: string|null; member_id: string|null };
export type Period = { id?: string; task_id: string; start: string; end: string; room: string|null; member_id: string|null; done: boolean; done_at: string|null; preview: boolean };

// ---------- Fechas como texto 'AAAA-MM-DD' (sin zona horaria) ----------
const DAY = 86400000;
const toTime = (iso: string) => Date.parse(iso + 'T00:00:00Z');
const toIso = (t: number) => new Date(t).toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => toIso(toTime(iso) + n * DAY);
export const mondayOf = (iso: string) => addDays(iso, -((new Date(toTime(iso)).getUTCDay() + 6) % 7));
const monthStartOf = (iso: string) => iso.slice(0, 8) + '01';
const monthEndOf = (iso: string) => { const [y, m] = iso.split('-').map(Number); return toIso(Date.UTC(y, m, 0)); };
const EPOCH_MONDAY = '2024-01-01';

// Semana de lunes a domingo, o mes calendario, según la frecuencia de la tarea.
export function periodOf(task: Pick<Task,'frequency'>, iso: string) {
  if (task.frequency === 'monthly') return { start: monthStartOf(iso), end: monthEndOf(iso) };
  const start = mondayOf(iso); return { start, end: addDays(start, 6) };
}
function periodIndex(task: Pick<Task,'frequency'>, start: string) {
  if (task.frequency === 'monthly') { const [y, m] = start.split('-').map(Number); return y * 12 + m - 1; }
  return Math.round((toTime(start) - toTime(EPOCH_MONDAY)) / (7 * DAY));
}
const nextPeriodStart = (task: Pick<Task,'frequency'>, start: string) => task.frequency === 'monthly' ? addDays(monthEndOf(start), 1) : addDays(start, 7);

const byNumber = (a: string, b: string) => a.localeCompare(b, 'es', { numeric: true });

export async function loadCandidates(db: Db, homeId: string) {
  const { data, error } = await db.from('users').select('id,name,room,created_at').eq('home_id', homeId).eq('role', 'resident').eq('active', true);
  if (error) throw error;
  const people = (data || []).filter(p => p.room).sort((a, b) => byNumber(a.room!, b.room!) || a.created_at.localeCompare(b.created_at));
  const rooms = [...new Set(people.map(p => p.room as string))].sort(byNumber);
  // Quiénes usan cada baño: la limpieza de un baño rota solo entre ellos.
  const { data: baths, error: bErr } = await db.from('bathrooms').select('id,name,bathroom_members(member_id)').eq('home_id', homeId).order('created_at');
  if (bErr) throw bErr;
  const bathrooms = (baths || []).map((b: any) => ({ id: b.id as string, name: b.name as string, member_ids: (b.bathroom_members || []).map((m: any) => m.member_id as string) }));
  return { people, rooms, bathrooms };
}

// Rotación: cada período le toca al siguiente de la lista; cada tarea arranca desplazada
// para que no les toque todo a los mismos.
export function rotate(task: Task, taskIndex: number, start: string, c: { people: { id: string; room: string|null }[]; rooms: string[]; bathrooms?: { id: string; member_ids: string[] }[] }): Candidate {
  const i = taskIndex + periodIndex(task, start);
  if (task.assign_by === 'person') {
    const pool = task.bathroom_id ? c.people.filter(p => c.bathrooms?.find(b => b.id === task.bathroom_id)?.member_ids.includes(p.id)) : c.people;
    if (!pool.length) return { room: null, member_id: null };
    const p = pool[(task.bathroom_id ? periodIndex(task, start) : i) % pool.length]; return { room: p.room, member_id: p.id };
  }
  if (!c.rooms.length) return { room: null, member_id: null };
  return { room: c.rooms[i % c.rooms.length], member_id: null };
}

export async function loadTasks(db: Db, homeId: string) {
  const { data, error } = await db.from('tasks').select('id,name,position,frequency,assign_by,bathroom_id').eq('home_id', homeId).order('position').order('created_at');
  if (error) throw error;
  return (data || []) as Task[];
}

const fmt = (iso: string) => { const [, m, d] = iso.split('-'); return `${Number(d)}/${Number(m)}`; };
export function periodLabel(task: Pick<Task,'frequency'>, start: string, end: string) { return task.frequency === 'monthly' ? 'Este mes' : `Esta semana (${fmt(start)} al ${fmt(end)})`; }

// Avisa a quien le toca: a la persona, o a todos los de la habitación.
export async function notifyAssignee(db: Db, homeId: string, task: Task, row: { room: string|null; member_id: string|null; start: string; end: string }) {
  let ids: string[] = [];
  if (row.member_id) ids = [row.member_id];
  else if (row.room) { const { data } = await db.from('users').select('id').eq('home_id', homeId).eq('role', 'resident').eq('active', true).eq('room', row.room); ids = (data || []).map(u => u.id); }
  const who = row.member_id ? 'te toca' : 'a tu habitación le toca';
  await notify(db, ids.map(user_id => ({ home_id: homeId, user_id, title: '🧹 Tarea asignada', message: `${periodLabel(task, row.start, row.end)} ${who}: ${task.name}.`, kind: 'task' })));
}

// Guarda la asignación del período en curso de cada tarea (si falta) y le avisa a quien le toca.
// Una vez guardada no cambia, así el dueño puede corregirla y el historial queda fijo.
export async function ensureCurrent(db: Db, homeId: string) {
  const today = todayAR().iso;
  const [tasks, cands] = await Promise.all([loadTasks(db, homeId), loadCandidates(db, homeId)]);
  if (!tasks.length) return;
  const periods = tasks.map(t => ({ task: t, ...periodOf(t, today) }));
  const { data: existing, error } = await db.from('task_assignments').select('task_id,period_start').eq('home_id', homeId).in('period_start', [...new Set(periods.map(p => p.start))]);
  if (error) throw error;
  const have = new Set((existing || []).map(e => `${e.task_id}|${e.period_start}`));
  for (const [i, p] of periods.entries()) {
    if (have.has(`${p.task.id}|${p.start}`)) continue;
    const who = rotate(p.task, i, p.start, cands);
    if (!who.room && !who.member_id) continue;
    const { data: inserted, error: insErr } = await db.from('task_assignments').upsert({ home_id: homeId, task_id: p.task.id, period_start: p.start, period_end: p.end, room: who.room, member_id: who.member_id, done: false }, { onConflict: 'task_id,period_start', ignoreDuplicates: true }).select('id');
    if (insErr) throw insErr;
    if (inserted?.length) await notifyAssignee(db, homeId, p.task, { ...who, start: p.start, end: p.end });
  }
}

// Todo lo que se muestra en el calendario de un mes: asignaciones guardadas y, para los períodos
// futuros que todavía no se guardaron, una vista previa de la rotación.
export async function monthView(db: Db, homeId: string, month: string) {
  const first = month + '-01';
  const from = mondayOf(first), to = addDays(mondayOf(monthEndOf(first)), 6);
  const today = todayAR().iso;
  const [tasks, cands, { data: rows, error }] = await Promise.all([
    loadTasks(db, homeId), loadCandidates(db, homeId),
    db.from('task_assignments').select('id,task_id,period_start,period_end,room,member_id,done,done_at').eq('home_id', homeId).not('period_start', 'is', null).lte('period_start', to).gte('period_end', from),
  ]);
  if (error) throw error;
  const periods: Period[] = (rows || []).map(r => ({ id: r.id, task_id: r.task_id, start: r.period_start, end: r.period_end, room: r.room, member_id: r.member_id, done: r.done, done_at: r.done_at, preview: false }));
  tasks.forEach((t, i) => {
    const current = periodOf(t, today).start;
    for (let start = periodOf(t, from).start; start <= to; start = nextPeriodStart(t, start)) {
      const end = periodOf(t, start).end;
      if (start < current) continue;
      if (periods.some(p => p.task_id === t.id && p.start <= end && p.end >= start)) continue;
      const who = rotate(t, i, start, cands);
      periods.push({ task_id: t.id, start, end, ...who, done: false, done_at: null, preview: true });
    }
  });
  periods.sort((a, b) => a.start.localeCompare(b.start));
  return { month, from, to, today, tasks, people: cands.people.map(p => ({ id: p.id, name: p.name, room: p.room })), rooms: cands.rooms, bathrooms: cands.bathrooms, periods };
}
