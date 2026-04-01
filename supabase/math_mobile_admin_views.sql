create or replace view public.math_mobile_profiles_admin_view as
select
  p.id as profile_id,
  p.email,
  p.full_name,
  p.avatar_url,
  p.created_at as profile_created_at,
  p.updated_at as profile_updated_at,
  u.created_at as auth_created_at,
  u.last_sign_in_at,
  u.email_confirmed_at,
  u.confirmation_sent_at,
  u.role as auth_role
from public.math_mobile_profiles p
left join auth.users u on u.id = p.id;

create or replace view public.math_mobile_problem_queries_by_profile as
select
  pr.id as query_id,
  pr.user_id as profile_id,
  p.email as profile_email,
  p.full_name as profile_name,
  pr.title,
  pr.prompt,
  pr.status,
  pr.final_answer,
  pr.explanation,
  pr.input_type,
  pr.created_at,
  pr.updated_at
from public.math_mobile_problems pr
join public.math_mobile_profiles p on p.id = pr.user_id;
