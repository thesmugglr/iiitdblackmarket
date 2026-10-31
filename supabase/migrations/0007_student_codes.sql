-- Automatic approval for current students, using only numbers. Apply after 0006_launch.sql.
--
-- IIIT-Delhi student addresses look like <name><yy><serial>@iiitd.ac.in, where yy+serial are the last five digits
-- of the roll number (roll 2025025 -> abhik25025@iiitd.ac.in). The institute publishes the current B.Tech roll
-- numbers on its public students page. We store ONLY those five-digit codes (no names, no addresses) in an
-- admin-only table, and approve a provider-verified institute address when its trailing five digits are listed.
-- Everyone else (faculty, alumni, M.Tech/PhD, newly admitted) still waits for an admin.

create table public.student_codes (
  code text primary key check (code ~ '^[0-9]{5}$')
);
alter table public.student_codes enable row level security;
revoke all on public.student_codes from public, anon, authenticated;

-- BEGIN STUDENT CODE LOGIC (idempotent: safe to run again)
-- The five-digit code of an address shaped like letters followed by exactly five digits, else null.
create or replace function public.student_code_of(p_email text) returns text
language sql immutable as $$
  select (regexp_match(lower(p_email), '^[a-z][a-z._-]*([0-9]{5})@iiitd\.ac\.in$'))[1]
$$;

create or replace function public.is_listed_student(p_email text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.student_codes c where c.code = public.student_code_of(p_email))
$$;
revoke execute on function public.student_code_of(text) from public, anon, authenticated;
revoke execute on function public.is_listed_student(text) from public, anon, authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(new.email);
  -- GoTrue inserts the user first and confirms the email in a follow-up update, so this is often still false
  -- here; promote_confirmed_user() covers that order. app_metadata is only ever set server-side.
  v_verified boolean := coalesce(new.raw_app_meta_data->>'provider', '') = 'google' or new.email_confirmed_at is not null;
  v_admin boolean;
  v_roster boolean;
  v_listed boolean;
  v_name text;
begin
  -- Server-side institute-domain check (the domain alone does NOT make someone a student).
  if v_email is null or v_email not like '%@iiitd.ac.in' then
    raise exception 'Only @iiitd.ac.in accounts are allowed';
  end if;
  -- Privileges only apply to emails verified by the identity provider.
  v_admin := v_verified and exists (select 1 from public.admin_bootstrap b where b.email = v_email);
  v_roster := v_verified and exists (select 1 from public.student_roster s where s.email = v_email);
  v_listed := v_verified and public.is_listed_student(v_email);
  v_name := coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), nullif(new.raw_user_meta_data->>'name', ''), split_part(v_email, '@', 1));
  insert into public.profiles (id, email, display_name, role, status)
  values (new.id, v_email, left(v_name, 80),
          case when v_admin then 'admin' else 'student' end,
          case when v_admin or v_roster or v_listed then 'approved' else 'pending' end);
  return new;
end $$;

-- When the email becomes confirmed (Google confirms it right after the user is created), apply the
-- bootstrap-admin, roster and student-code rules to a profile that is still pending. Never touches anyone else.
create or replace function public.promote_confirmed_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_email text := lower(new.email);
begin
  if new.email_confirmed_at is null or old.email_confirmed_at is not null then return new; end if;
  update public.profiles
     set role = case when exists (select 1 from public.admin_bootstrap b where b.email = v_email) then 'admin' else role end,
         status = 'approved'
   where id = new.id and status = 'pending'
     and (exists (select 1 from public.admin_bootstrap b where b.email = v_email)
          or exists (select 1 from public.student_roster s where s.email = v_email)
          or public.is_listed_student(v_email));
  return new;
end $$;

-- After loading new codes, approve people who were already waiting. Only pending students are touched:
-- suspended or rejected accounts and admins are left alone. Run from the SQL editor.
create or replace function public.approve_listed_students() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  -- Same verification rule as the sign-up triggers: the address must be provider-verified.
  update public.profiles p set status = 'approved'
   where p.status = 'pending' and p.role = 'student' and public.is_listed_student(p.email)
     and exists (select 1 from auth.users u where u.id = p.id
                 and (u.email_confirmed_at is not null or coalesce(u.raw_app_meta_data->>'provider', '') = 'google'));
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.approve_listed_students() from public, anon, authenticated;
-- END STUDENT CODE LOGIC
