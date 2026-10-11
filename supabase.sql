-- NIDAPP - Supabase PostgreSQL schema / migration
create extension if not exists pgcrypto;

create table if not exists homes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  rent_due_day integer not null default 5 check (rent_due_day between 1 and 28),
  created_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  home_id uuid references homes(id) on delete cascade,
  username text not null unique,
  name text not null,
  password_hash text not null,
  role text not null check (role in ('owner','resident')),
  room text,
  email text,
  phone text,
  emergency_phone text,
  photo_path text,
  presence_location text,
  presence_updated_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Safe migration when the original NIDAPP schema already exists.
alter table users add column if not exists email text;
alter table users add column if not exists phone text;
alter table users add column if not exists emergency_phone text;
alter table users add column if not exists photo_path text;
alter table users add column if not exists presence_location text;
alter table users add column if not exists presence_updated_at timestamptz;

create table if not exists notices (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references homes(id) on delete cascade,
  author_id uuid not null references users(id) on delete cascade,
  title text not null,
  description text not null,
  category text not null default 'General',
  priority text not null default 'Media' check (priority in ('Baja','Media','Alta')),
  status text not null default 'Pendiente' check (status in ('Pendiente','En progreso','Resuelto')),
  created_at timestamptz not null default now()
);

create table if not exists laundry_reservations (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references homes(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  finished boolean not null default false,
  created_at timestamptz not null default now(),
  unique(home_id, date, start_time)
);
alter table laundry_reservations add column if not exists finished boolean not null default false;

create table if not exists rent_payments (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references homes(id) on delete cascade,
  resident_id uuid not null references users(id) on delete cascade,
  due_date date not null,
  amount numeric(12,2) not null default 0,
  paid boolean not null default false,
  paid_at timestamptz,
  proof_path text,
  proof_uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  unique(home_id, resident_id, due_date)
);
alter table rent_payments add column if not exists proof_path text;
alter table rent_payments add column if not exists proof_uploaded_at timestamptz;

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references homes(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  message text not null,
  kind text not null default 'info',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_users_home on users(home_id);
create index if not exists idx_notice_home on notices(home_id, created_at desc);
create index if not exists idx_laundry_home_date on laundry_reservations(home_id, date);
create index if not exists idx_rent_home_due on rent_payments(home_id, due_date);
create index if not exists idx_notifications_user on notifications(user_id, read, created_at desc);

-- Private bucket. The application uses the Supabase service role on the server,
-- so photos/comprobantes are never made public.
insert into storage.buckets (id,name,public)
values ('nidapp-files','nidapp-files',false)
on conflict (id) do nothing;

-- Demo data (optional). Safe to re-run: it only inserts what is missing.
insert into homes (name,address,rent_due_day)
select 'Casa NIDAPP','Av. Pixel 123',5
where not exists (select 1 from homes where name='Casa NIDAPP');
with h as (select id from homes where name='Casa NIDAPP' order by created_at limit 1)
insert into users(home_id,username,name,password_hash,role,room,email,phone,emergency_phone)
select h.id,'dueno','Dueño','$2y$10$fwZpaVjwMBus0mMINXHw/e.aYb4qhH.d.5.7X1P12.13VmyCqeVCW','owner',null,'dueno@nidapp.local','', '' from h
on conflict(username) do nothing;
with h as (select id from homes where name='Casa NIDAPP' order by created_at limit 1)
insert into users(home_id,username,name,password_hash,role,room,email,phone,emergency_phone)
select h.id,'sofi','Sofi','$2y$10$fwZpaVjwMBus0mMINXHw/e.aYb4qhH.d.5.7X1P12.13VmyCqeVCW','resident','3','sofi@nidapp.local','','' from h
on conflict(username) do nothing;
-- Demo password: demo1234. Cambiala apenas compruebes que todo funciona.

-- ============================================================
-- v2: habitaciones, servicios, tareas, invitados, gastos
-- ============================================================

-- Habitaciones: cantidad, cupo y precio por habitación.
create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references homes(id) on delete cascade,
  number text not null,
  capacity integer not null default 1 check (capacity between 1 and 10),
  price numeric(12,2) not null default 60000 check (price >= 0),
  created_at timestamptz not null default now(),
  unique(home_id, number)
);
-- Crea las habitaciones 1 a 6 en las residencias que todavía no tienen ninguna.
insert into rooms (home_id, number)
select h.id, n::text from homes h cross join generate_series(1,6) n
where not exists (select 1 from rooms r where r.home_id = h.id);

-- Otros cobros mensuales (servicios): monto fijo por habitante.
create table if not exists extra_charges (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references homes(id) on delete cascade,
  name text not null,
  amount numeric(12,2) not null check (amount >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Cada pago mensual guarda el alquiler y el detalle de servicios de ese mes.
alter table rent_payments add column if not exists room text;
alter table rent_payments add column if not exists services_amount numeric(12,2) not null default 0;
alter table rent_payments add column if not exists services_detail jsonb not null default '[]'::jsonb;

-- Pagos editados a mano (no se recalculan) y cobros anulados por el dueño.
alter table rent_payments add column if not exists manual boolean not null default false;
alter table rent_payments add column if not exists cancelled boolean not null default false;

-- Tareas mensuales que rotan entre habitaciones.
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references homes(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
insert into tasks (home_id, name, position)
select h.id, t.name, t.pos from homes h
cross join (values ('Tirar la basura',0),('Limpiar el baño',1)) as t(name,pos)
where not exists (select 1 from tasks x where x.home_id = h.id);

create table if not exists task_assignments (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references homes(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  room text not null,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  unique(task_id, month)
);

-- Invitados: la imagen solo la ve el dueño.
create table if not exists guests (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references homes(id) on delete cascade,
  resident_id uuid not null references users(id) on delete cascade,
  guest_name text not null,
  visit_date date not null,
  start_time time not null,
  end_time time not null,
  notes text,
  photo_path text,
  created_at timestamptz not null default now()
);

-- Gastos de la casa (solo dueño).
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references homes(id) on delete cascade,
  item text not null,
  category text not null default 'Otros',
  quantity integer not null default 1 check (quantity > 0),
  amount numeric(12,2) not null check (amount >= 0),
  spent_on date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

-- Intentos de login, para frenar ataques de fuerza bruta.
create table if not exists login_attempts (
  id bigint generated always as identity primary key,
  username text not null,
  attempted_at timestamptz not null default now()
);

create index if not exists idx_rooms_home on rooms(home_id);
create index if not exists idx_charges_home on extra_charges(home_id);
create index if not exists idx_tasks_home on tasks(home_id);
create index if not exists idx_task_assign_home_month on task_assignments(home_id, month);
create index if not exists idx_guests_home_date on guests(home_id, visit_date);
create index if not exists idx_expenses_home_date on expenses(home_id, spent_on desc);
create index if not exists idx_login_attempts on login_attempts(username, attempted_at desc);

-- Seguridad: la app usa la service role desde el servidor, que ignora RLS.
-- Activar RLS sin políticas bloquea el acceso directo con la clave anon a la API de Supabase.
alter table homes enable row level security;
alter table users enable row level security;
alter table notices enable row level security;
alter table laundry_reservations enable row level security;
alter table rent_payments enable row level security;
alter table notifications enable row level security;
alter table rooms enable row level security;
alter table extra_charges enable row level security;
alter table tasks enable row level security;
alter table task_assignments enable row level security;
alter table guests enable row level security;
alter table expenses enable row level security;
alter table login_attempts enable row level security;

-- ============================================================
-- v3: fotos en avisos, normas editables, aviso de pago
-- ============================================================

-- Foto opcional en los avisos (la ven todos los de la residencia).
alter table notices add column if not exists photo_path text;

-- El habitante avisa que pagó; el dueño después confirma el pago.
alter table rent_payments add column if not exists reported_at timestamptz;

-- Normas de convivencia editables por el dueño.
create table if not exists rules (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references homes(id) on delete cascade,
  icon text not null default '📌',
  title text not null,
  body text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_rules_home on rules(home_id, position);
insert into rules (home_id, icon, title, body, position)
select h.id, r.icon, r.title, r.body, r.pos from homes h
cross join (values
  ('🧹','Limpieza','Dejá los espacios comunes limpios después de usarlos. Respetá los turnos y avisá si algo se rompe.',0),
  ('🔇','Ruido','Evitemos ruidos fuertes durante la noche. Si necesitás hacer una reunión, avisá con anticipación.',1),
  ('🧺','Lavarropas','Respetá la reserva, retirá la ropa al terminar y marcá la reserva como finalizada.',2),
  ('🍽️','Cocina','Lavá tus utensilios y no ocupes indefinidamente las superficies comunes.',3),
  ('🤝','Respeto','Tratemos a todos con respeto. Los problemas importantes deben comunicarse mediante avisos.',4),
  ('🚪','Espacios privados','Respetá habitaciones y pertenencias ajenas. No ingreses a un cuarto sin permiso.',5),
  ('🙋','Invitados','Avisá en la sección Invitados quién viene y en qué horario.',6),
  ('🗑️','Tareas del mes','Cada mes a cada habitación le toca una tarea. Revisala en Tareas y marcala cuando la hagas.',7)
) as r(icon,title,body,pos)
where not exists (select 1 from rules x where x.home_id = h.id);
alter table rules enable row level security;

-- ============================================================
-- v4: cuentas por persona, varias residencias, invitaciones, push
-- ============================================================

-- Una cuenta por persona (email + contraseña). Cada fila de "users" pasa a ser
-- la membresía de esa cuenta en una residencia (rol, habitación, datos de contacto).
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  email text,
  password_hash text not null,
  name text not null,
  last_member_id uuid,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_accounts_email on accounts(lower(email)) where email is not null;

alter table users add column if not exists account_id uuid references accounts(id) on delete cascade;
alter table users alter column password_hash drop not null;
create unique index if not exists idx_users_account_home on users(account_id, home_id) where account_id is not null;
create index if not exists idx_users_account on users(account_id);

-- Encargados: mismos permisos que el dueño dentro de la residencia.
alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check check (role in ('owner','admin','resident'));

-- Migración: crea una cuenta por cada usuario existente (si dos comparten email, solo la primera lo conserva).
do $$
declare r record; acc uuid; em text;
begin
  for r in select * from users where account_id is null order by created_at loop
    em := nullif(lower(trim(coalesce(r.email,''))),'');
    if em is not null and exists (select 1 from accounts where lower(email) = em) then em := null; end if;
    insert into accounts (email, password_hash, name) values (em, coalesce(r.password_hash,''), r.name) returning id into acc;
    update users set account_id = acc where id = r.id;
  end loop;
end $$;

alter table homes add column if not exists created_by uuid references accounts(id) on delete set null;

-- Invitaciones por código o link.
create table if not exists invites (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references homes(id) on delete cascade,
  code text not null unique,
  role text not null default 'resident' check (role in ('resident','admin')),
  room text,
  created_by uuid references users(id) on delete set null,
  uses integer not null default 0,
  max_uses integer not null default 1 check (max_uses between 1 and 50),
  expires_at timestamptz not null default now() + interval '14 days',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_invites_home on invites(home_id);

-- Recuperación de contraseña por email.
create table if not exists password_resets (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

-- Notificaciones push del celular (una suscripción por dispositivo).
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_push_account on push_subscriptions(account_id);

alter table accounts enable row level security;
alter table invites enable row level security;
alter table password_resets enable row level security;
alter table push_subscriptions enable row level security;

-- ============================================================
-- v5: tareas semanales, por habitación o por habitante
-- ============================================================
alter table tasks add column if not exists frequency text not null default 'weekly' check (frequency in ('weekly','monthly'));
alter table tasks add column if not exists assign_by text not null default 'room' check (assign_by in ('room','person'));
-- La limpieza del baño rota por persona.
update tasks set assign_by = 'person' where name ilike '%baño%' and assign_by = 'room';

-- Cada asignación cubre un período (semana de lunes a domingo, o mes) para una habitación o una persona.
alter table task_assignments add column if not exists period_start date;
alter table task_assignments add column if not exists period_end date;
alter table task_assignments add column if not exists member_id uuid references users(id) on delete set null;
alter table task_assignments alter column room drop not null;
alter table task_assignments alter column month drop not null;
update task_assignments
  set period_start = (month || '-01')::date,
      period_end = ((month || '-01')::date + interval '1 month - 1 day')::date
  where period_start is null and month is not null;
-- Las asignaciones mensuales viejas de tareas que ahora son semanales terminan el domingo anterior a esta semana.
update task_assignments a
  set period_end = (date_trunc('week', (now() at time zone 'America/Argentina/Buenos_Aires'))::date - 1)
  from tasks t
  where a.task_id = t.id and t.frequency = 'weekly'
    and a.period_start < date_trunc('week', (now() at time zone 'America/Argentina/Buenos_Aires'))::date
    and a.period_end >= date_trunc('week', (now() at time zone 'America/Argentina/Buenos_Aires'))::date;
create unique index if not exists idx_task_assign_period on task_assignments(task_id, period_start);
create index if not exists idx_task_assign_home_period on task_assignments(home_id, period_start);

-- ============================================================
-- v6: baños con sus habitantes (la limpieza rota dentro de cada baño)
-- ============================================================
create table if not exists bathrooms (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references homes(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create table if not exists bathroom_members (
  bathroom_id uuid not null references bathrooms(id) on delete cascade,
  member_id uuid not null references users(id) on delete cascade,
  primary key (bathroom_id, member_id)
);
create index if not exists idx_bathrooms_home on bathrooms(home_id);
-- La tarea de limpieza de un baño se borra junto con el baño.
alter table tasks add column if not exists bathroom_id uuid references bathrooms(id) on delete cascade;

-- Convierte cada tarea "baño" existente en un baño "Baño" con los habitantes activos de la residencia.
do $$
declare t record; b uuid;
begin
  for t in select * from tasks where name ilike '%baño%' and bathroom_id is null loop
    insert into bathrooms (home_id, name) values (t.home_id, 'Baño') returning id into b;
    insert into bathroom_members (bathroom_id, member_id)
      select b, id from users where home_id = t.home_id and role = 'resident' and active;
    update tasks set bathroom_id = b, assign_by = 'person', name = 'Limpiar Baño' where id = t.id;
  end loop;
end $$;

alter table bathrooms enable row level security;
alter table bathroom_members enable row level security;

-- ============================================================
-- v7: registro de cobros anulados (motivo y fecha, se pueden restaurar)
-- ============================================================
alter table rent_payments add column if not exists cancel_reason text;
alter table rent_payments add column if not exists cancelled_at timestamptz;

-- ============================================================
-- v8: finanzas (otros ingresos además del alquiler)
-- ============================================================
create table if not exists incomes (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references homes(id) on delete cascade,
  concept text not null,
  category text not null default 'Otros',
  amount numeric(12,2) not null check (amount >= 0),
  received_on date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_incomes_home_date on incomes(home_id, received_on desc);
create index if not exists idx_rent_home_paid_at on rent_payments(home_id, paid_at);
alter table incomes enable row level security;

-- ============================================================
-- v9: ajustes de alquiler por índice
-- ============================================================
alter table homes add column if not exists adjust_type text not null default 'none' check (adjust_type in ('none','percent','ipc','icl','other'));
alter table homes add column if not exists adjust_every integer not null default 3 check (adjust_every between 1 and 24);
alter table homes add column if not exists adjust_percent numeric(6,2);
alter table homes add column if not exists next_adjust date;

-- Historial de ajustes: qué porcentaje se aplicó, desde qué mes y los precios antes y después.
create table if not exists rent_adjustments (
  id uuid primary key default gen_random_uuid(),
  home_id uuid not null references homes(id) on delete cascade,
  effective_month text not null check (effective_month ~ '^[0-9]{4}-[0-9]{2}$'),
  percent numeric(7,3) not null,
  method text not null default 'other',
  note text,
  status text not null default 'scheduled' check (status in ('scheduled','applied','cancelled')),
  prices_before jsonb,
  prices_after jsonb,
  created_at timestamptz not null default now(),
  applied_at timestamptz
);
create index if not exists idx_rent_adjust_home on rent_adjustments(home_id, effective_month);
alter table rent_adjustments enable row level security;

-- ============================================================
-- v10: comentarios de la etapa de prueba
-- ============================================================
-- Lo que mandan dueños y habitantes desde Inicio → "Contanos qué te parece".
-- Se lee desde el panel de Supabase (Table editor → feedback).
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  home_id uuid references homes(id) on delete set null,
  user_id uuid references users(id) on delete set null,
  role text,
  kind text not null default 'other' check (kind in ('idea','bug','like','other')),
  rating integer check (rating between 1 and 5),
  message text not null check (char_length(message) between 3 and 2000),
  device text,
  created_at timestamptz not null default now()
);
create index if not exists idx_feedback_created on feedback(created_at desc);
create index if not exists idx_feedback_user on feedback(user_id, created_at);
alter table feedback enable row level security;
