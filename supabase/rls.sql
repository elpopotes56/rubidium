alter table public.math_mobile_profiles enable row level security;
alter table public.math_mobile_topics enable row level security;
alter table public.math_mobile_problems enable row level security;
alter table public.math_mobile_solution_steps enable row level security;
alter table public.math_mobile_voice_sessions enable row level security;
alter table public.math_mobile_voice_messages enable row level security;
alter table public.math_mobile_user_topic_stats enable row level security;

create policy "math_mobile_profiles_select_own"
on public.math_mobile_profiles
for select
using (auth.uid() = id);

create policy "math_mobile_profiles_update_own"
on public.math_mobile_profiles
for update
using (auth.uid() = id);

create policy "math_mobile_profiles_insert_own"
on public.math_mobile_profiles
for insert
with check (auth.uid() = id);

create policy "math_mobile_topics_select_authenticated"
on public.math_mobile_topics
for select
to authenticated
using (true);

create policy "math_mobile_problems_select_own"
on public.math_mobile_problems
for select
using (auth.uid() = user_id);

create policy "math_mobile_problems_insert_own"
on public.math_mobile_problems
for insert
with check (auth.uid() = user_id);

create policy "math_mobile_problems_update_own"
on public.math_mobile_problems
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "math_mobile_problems_delete_own"
on public.math_mobile_problems
for delete
using (auth.uid() = user_id);

create policy "math_mobile_solution_steps_select_own"
on public.math_mobile_solution_steps
for select
using (auth.uid() = user_id);

create policy "math_mobile_solution_steps_insert_own"
on public.math_mobile_solution_steps
for insert
with check (auth.uid() = user_id);

create policy "math_mobile_solution_steps_update_own"
on public.math_mobile_solution_steps
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "math_mobile_solution_steps_delete_own"
on public.math_mobile_solution_steps
for delete
using (auth.uid() = user_id);

create policy "math_mobile_voice_sessions_select_own"
on public.math_mobile_voice_sessions
for select
using (auth.uid() = user_id);

create policy "math_mobile_voice_sessions_insert_own"
on public.math_mobile_voice_sessions
for insert
with check (auth.uid() = user_id);

create policy "math_mobile_voice_sessions_update_own"
on public.math_mobile_voice_sessions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "math_mobile_voice_sessions_delete_own"
on public.math_mobile_voice_sessions
for delete
using (auth.uid() = user_id);

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

create policy "math_mobile_user_topic_stats_select_own"
on public.math_mobile_user_topic_stats
for select
using (auth.uid() = user_id);

create policy "math_mobile_user_topic_stats_insert_own"
on public.math_mobile_user_topic_stats
for insert
with check (auth.uid() = user_id);

create policy "math_mobile_user_topic_stats_update_own"
on public.math_mobile_user_topic_stats
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "math_mobile_user_topic_stats_delete_own"
on public.math_mobile_user_topic_stats
for delete
using (auth.uid() = user_id);
