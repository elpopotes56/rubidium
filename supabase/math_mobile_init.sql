create extension if not exists "pgcrypto";

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'math_mobile_problem_input_type'
  ) then
    create type public.math_mobile_problem_input_type as enum ('text', 'voice', 'image');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'math_mobile_problem_status'
  ) then
    create type public.math_mobile_problem_status as enum ('pending', 'solved', 'failed');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'math_mobile_session_role'
  ) then
    create type public.math_mobile_session_role as enum ('user', 'assistant');
  end if;
end $$;

create table if not exists public.math_mobile_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.math_mobile_topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.math_mobile_problems (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.math_mobile_profiles(id) on delete cascade,
  topic_id uuid references public.math_mobile_topics(id) on delete set null,
  title text,
  prompt text not null,
  normalized_text text,
  input_type public.math_mobile_problem_input_type not null default 'text',
  status public.math_mobile_problem_status not null default 'pending',
  final_answer text,
  explanation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.math_mobile_solution_steps (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.math_mobile_problems(id) on delete cascade,
  user_id uuid not null references public.math_mobile_profiles(id) on delete cascade,
  step_number integer not null,
  title text,
  explanation text not null,
  latex text,
  created_at timestamptz not null default now(),
  constraint math_mobile_solution_steps_problem_id_step_number_key unique (problem_id, step_number)
);

create table if not exists public.math_mobile_voice_sessions (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid references public.math_mobile_problems(id) on delete set null,
  user_id uuid not null references public.math_mobile_profiles(id) on delete cascade,
  provider text not null default 'elevenlabs',
  external_call_id text,
  transcript text,
  summary text,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.math_mobile_voice_messages (
  id uuid primary key default gen_random_uuid(),
  voice_session_id uuid not null references public.math_mobile_voice_sessions(id) on delete cascade,
  role public.math_mobile_session_role not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.math_mobile_user_topic_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.math_mobile_profiles(id) on delete cascade,
  topic_id uuid not null references public.math_mobile_topics(id) on delete cascade,
  solved_count integer not null default 0,
  failed_count integer not null default 0,
  last_problem_at timestamptz,
  average_score double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint math_mobile_user_topic_stats_user_id_topic_id_key unique (user_id, topic_id)
);

create index if not exists math_mobile_problems_user_id_created_at_idx
on public.math_mobile_problems (user_id, created_at desc);

create index if not exists math_mobile_problems_topic_id_idx
on public.math_mobile_problems (topic_id);

create index if not exists math_mobile_solution_steps_user_id_created_at_idx
on public.math_mobile_solution_steps (user_id, created_at desc);

create index if not exists math_mobile_voice_sessions_user_id_started_at_idx
on public.math_mobile_voice_sessions (user_id, started_at desc);

create index if not exists math_mobile_voice_sessions_problem_id_idx
on public.math_mobile_voice_sessions (problem_id);

create index if not exists math_mobile_voice_messages_voice_session_id_created_at_idx
on public.math_mobile_voice_messages (voice_session_id, created_at);

create index if not exists math_mobile_user_topic_stats_user_id_idx
on public.math_mobile_user_topic_stats (user_id);

create index if not exists math_mobile_user_topic_stats_topic_id_idx
on public.math_mobile_user_topic_stats (topic_id);

alter table public.math_mobile_profiles enable row level security;
alter table public.math_mobile_topics enable row level security;
alter table public.math_mobile_problems enable row level security;
alter table public.math_mobile_solution_steps enable row level security;
alter table public.math_mobile_voice_sessions enable row level security;
alter table public.math_mobile_voice_messages enable row level security;
alter table public.math_mobile_user_topic_stats enable row level security;

drop policy if exists "math_mobile_profiles_select_own" on public.math_mobile_profiles;
create policy "math_mobile_profiles_select_own"
on public.math_mobile_profiles
for select
using (auth.uid() = id);

drop policy if exists "math_mobile_profiles_update_own" on public.math_mobile_profiles;
create policy "math_mobile_profiles_update_own"
on public.math_mobile_profiles
for update
using (auth.uid() = id);

drop policy if exists "math_mobile_profiles_insert_own" on public.math_mobile_profiles;
create policy "math_mobile_profiles_insert_own"
on public.math_mobile_profiles
for insert
with check (auth.uid() = id);

drop policy if exists "math_mobile_topics_select_authenticated" on public.math_mobile_topics;
create policy "math_mobile_topics_select_authenticated"
on public.math_mobile_topics
for select
to authenticated
using (true);

drop policy if exists "math_mobile_problems_select_own" on public.math_mobile_problems;
create policy "math_mobile_problems_select_own"
on public.math_mobile_problems
for select
using (auth.uid() = user_id);

drop policy if exists "math_mobile_problems_insert_own" on public.math_mobile_problems;
create policy "math_mobile_problems_insert_own"
on public.math_mobile_problems
for insert
with check (auth.uid() = user_id);

drop policy if exists "math_mobile_problems_update_own" on public.math_mobile_problems;
create policy "math_mobile_problems_update_own"
on public.math_mobile_problems
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "math_mobile_problems_delete_own" on public.math_mobile_problems;
create policy "math_mobile_problems_delete_own"
on public.math_mobile_problems
for delete
using (auth.uid() = user_id);

drop policy if exists "math_mobile_solution_steps_select_own" on public.math_mobile_solution_steps;
create policy "math_mobile_solution_steps_select_own"
on public.math_mobile_solution_steps
for select
using (auth.uid() = user_id);

drop policy if exists "math_mobile_solution_steps_insert_own" on public.math_mobile_solution_steps;
create policy "math_mobile_solution_steps_insert_own"
on public.math_mobile_solution_steps
for insert
with check (auth.uid() = user_id);

drop policy if exists "math_mobile_solution_steps_update_own" on public.math_mobile_solution_steps;
create policy "math_mobile_solution_steps_update_own"
on public.math_mobile_solution_steps
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "math_mobile_solution_steps_delete_own" on public.math_mobile_solution_steps;
create policy "math_mobile_solution_steps_delete_own"
on public.math_mobile_solution_steps
for delete
using (auth.uid() = user_id);

drop policy if exists "math_mobile_voice_sessions_select_own" on public.math_mobile_voice_sessions;
create policy "math_mobile_voice_sessions_select_own"
on public.math_mobile_voice_sessions
for select
using (auth.uid() = user_id);

drop policy if exists "math_mobile_voice_sessions_insert_own" on public.math_mobile_voice_sessions;
create policy "math_mobile_voice_sessions_insert_own"
on public.math_mobile_voice_sessions
for insert
with check (auth.uid() = user_id);

drop policy if exists "math_mobile_voice_sessions_update_own" on public.math_mobile_voice_sessions;
create policy "math_mobile_voice_sessions_update_own"
on public.math_mobile_voice_sessions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "math_mobile_voice_sessions_delete_own" on public.math_mobile_voice_sessions;
create policy "math_mobile_voice_sessions_delete_own"
on public.math_mobile_voice_sessions
for delete
using (auth.uid() = user_id);

drop policy if exists "math_mobile_voice_messages_select_own" on public.math_mobile_voice_messages;
create policy "math_mobile_voice_messages_select_own"
on public.math_mobile_voice_messages
for select
using (
  exists (
    select 1
    from public.math_mobile_voice_sessions vs
    where vs.id = voice_session_id
      and vs.user_id = auth.uid()
  )
);

drop policy if exists "math_mobile_voice_messages_insert_own" on public.math_mobile_voice_messages;
create policy "math_mobile_voice_messages_insert_own"
on public.math_mobile_voice_messages
for insert
with check (
  exists (
    select 1
    from public.math_mobile_voice_sessions vs
    where vs.id = voice_session_id
      and vs.user_id = auth.uid()
  )
);

drop policy if exists "math_mobile_voice_messages_update_own" on public.math_mobile_voice_messages;
create policy "math_mobile_voice_messages_update_own"
on public.math_mobile_voice_messages
for update
using (
  exists (
    select 1
    from public.math_mobile_voice_sessions vs
    where vs.id = voice_session_id
      and vs.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.math_mobile_voice_sessions vs
    where vs.id = voice_session_id
      and vs.user_id = auth.uid()
  )
);

drop policy if exists "math_mobile_voice_messages_delete_own" on public.math_mobile_voice_messages;
create policy "math_mobile_voice_messages_delete_own"
on public.math_mobile_voice_messages
for delete
using (
  exists (
    select 1
    from public.math_mobile_voice_sessions vs
    where vs.id = voice_session_id
      and vs.user_id = auth.uid()
  )
);

drop policy if exists "math_mobile_user_topic_stats_select_own" on public.math_mobile_user_topic_stats;
create policy "math_mobile_user_topic_stats_select_own"
on public.math_mobile_user_topic_stats
for select
using (auth.uid() = user_id);

drop policy if exists "math_mobile_user_topic_stats_insert_own" on public.math_mobile_user_topic_stats;
create policy "math_mobile_user_topic_stats_insert_own"
on public.math_mobile_user_topic_stats
for insert
with check (auth.uid() = user_id);

drop policy if exists "math_mobile_user_topic_stats_update_own" on public.math_mobile_user_topic_stats;
create policy "math_mobile_user_topic_stats_update_own"
on public.math_mobile_user_topic_stats
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "math_mobile_user_topic_stats_delete_own" on public.math_mobile_user_topic_stats;
create policy "math_mobile_user_topic_stats_delete_own"
on public.math_mobile_user_topic_stats
for delete
using (auth.uid() = user_id);
