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
