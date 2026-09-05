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

-- Demo data (optional). Run once after the schema.
insert into homes (name,address,rent_due_day) values ('Casa NIDAPP','Av. Pixel 123',5) on conflict do nothing;
with h as (select id from homes where name='Casa NIDAPP' limit 1)
insert into users(home_id,username,name,password_hash,role,room,email,phone,emergency_phone)
select h.id,'dueno','Dueño','$2y$10$fwZpaVjwMBus0mMINXHw/e.aYb4qhH.d.5.7X1P12.13VmyCqeVCW','owner',null,'dueno@nidapp.local','', '' from h
on conflict(username) do nothing;
with h as (select id from homes where name='Casa NIDAPP' limit 1)
insert into users(home_id,username,name,password_hash,role,room,email,phone,emergency_phone)
select h.id,'sofi','Sofi','$2y$10$fwZpaVjwMBus0mMINXHw/e.aYb4qhH.d.5.7X1P12.13VmyCqeVCW','resident','3','sofi@nidapp.local','','' from h
on conflict(username) do nothing;
-- Demo password: demo1234
