create extension if not exists pgcrypto;

-- The API owns signup, password hashing, sessions, and per-user authorization.
-- Never expose the Supabase service-role key in the browser.
create table if not exists public.auth_users (
  id text primary key,
  email text not null unique,
  password_hash text not null,
  created_at text not null
);

create table if not exists public.auth_sessions (
  token_hash text primary key,
  user_id text not null references public.auth_users(id) on delete cascade,
  expires_at text not null,
  created_at text not null
);

create table if not exists public.profiles (
  id text primary key references public.auth_users(id) on delete cascade,
  name text not null,
  age integer not null default 0,
  gender text not null default '',
  blood_group text not null default '',
  allergies text not null default '[]',
  medical_history text not null default '[]',
  created_at text not null
);

create table if not exists public.health_records (
  id text primary key,
  user_id text not null references public.profiles(id) on delete cascade,
  type text not null, value double precision not null, unit text not null,
  recorded_at text not null
);
create table if not exists public.symptoms (
  id text primary key,
  user_id text not null references public.profiles(id) on delete cascade,
  description text not null, severity smallint not null check (severity between 1 and 5),
  started_at text not null, created_at text not null
);
create table if not exists public.medications (
  id text primary key,
  user_id text not null references public.profiles(id) on delete cascade,
  name text not null, dosage text not null, frequency text not null,
  created_at text not null
);
create table if not exists public.reports (
  id text primary key,
  user_id text not null references public.profiles(id) on delete cascade,
  file_url text not null, file_name text not null, report_type text not null,
  extracted_text text not null, ai_summary text not null,
  created_at text not null
);
create table if not exists public.emergency_contacts (
  id text primary key,
  user_id text not null references public.profiles(id) on delete cascade,
  name text not null, phone text not null, relationship text not null,
  created_at text not null
);
create table if not exists public.emergency_events (
  id text primary key,
  user_id text not null references public.profiles(id) on delete cascade,
  latitude double precision not null, longitude double precision not null,
  trigger_type text not null, created_at text not null
);
create table if not exists public.chat_messages (
  id text primary key,
  user_id text not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  message text not null, created_at text not null
);

alter table public.auth_users enable row level security;
alter table public.auth_sessions enable row level security;
alter table public.profiles enable row level security;
alter table public.health_records enable row level security;
alter table public.symptoms enable row level security;
alter table public.medications enable row level security;
alter table public.reports enable row level security;
alter table public.emergency_contacts enable row level security;
alter table public.emergency_events enable row level security;
alter table public.chat_messages enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('medical-reports', 'medical-reports', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;
