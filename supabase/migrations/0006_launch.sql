-- Launch readiness. Apply after 0005_expiry_access.sql.
-- 1. First-admin bootstrap that needs no SQL after the owner's first sign-in.
-- 2. Admins are notified when someone new is waiting for approval.
-- 3. A trivial public function the host can call to keep a free-tier project active.

-- Emails listed here become approved admins on their first verified sign-in. Managed in the trusted SQL
-- editor or by the deployer; row level security with no policies keeps it closed to every API role.
create table public.admin_bootstrap (
  email text primary key check (email = lower(email) and email like '%@iiitd.ac.in')
);
alter table public.admin_bootstrap enable row level security;
revoke all on public.admin_bootstrap from public, anon, authenticated;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('message','wanted','expiry','approval'));

-- ───────── Everything between these markers is idempotent and is what a project that already ran an
-- ───────── earlier 0006 needs (see fix-signup-trigger.sql).
-- BEGIN SIGNUP TRIGGERS
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(new.email);
  -- GoTrue inserts the user first and confirms the email in a follow-up update, so this is often still false
  -- here; promote_confirmed_user() below covers that order. app_metadata is only ever set server-side.
  v_verified boolean := coalesce(new.raw_app_meta_data->>'provider', '') = 'google' or new.email_confirmed_at is not null;
  v_admin boolean;
  v_roster boolean;
  v_name text;
begin
  -- Server-side institute-domain check (the domain alone does NOT make someone a student).
  if v_email is null or v_email not like '%@iiitd.ac.in' then
    raise exception 'Only @iiitd.ac.in accounts are allowed';
  end if;
  -- Roster and bootstrap-admin privileges only apply to emails verified by the identity provider.
  v_admin := v_verified and exists (select 1 from public.admin_bootstrap b where b.email = v_email);
  v_roster := v_verified and exists (select 1 from public.student_roster s where s.email = v_email);
  v_name := coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), nullif(new.raw_user_meta_data->>'name', ''), split_part(v_email, '@', 1));
  insert into public.profiles (id, email, display_name, role, status)
  values (new.id, v_email, left(v_name, 80),
          case when v_admin then 'admin' else 'student' end,
          case when v_admin or v_roster then 'approved' else 'pending' end);
  return new;
end $$;

-- When the email becomes confirmed (Google confirms it right after the user is created), apply the
-- bootstrap-admin and roster rules to a profile that is still pending. Never touches anyone else.
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
          or exists (select 1 from public.student_roster s where s.email = v_email));
  return new;
end $$;
drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed after update of email_confirmed_at on auth.users
for each row execute function public.promote_confirmed_user();

-- Alert admins about someone waiting for approval. Deferred to the end of the sign-up transaction so people who
-- are approved moments after insert (roster, first admin) do not trigger a false alert.
create or replace function public.notify_admins_pending() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if (select status from public.profiles where id = new.id) is distinct from 'pending' then return null; end if;
  for r in select id from public.profiles where role = 'admin' and status = 'approved' loop
    perform public.notify(r.id, 'approval', 'Someone new is waiting for your approval', '/admin');
  end loop;
  return null;
end $$;
drop trigger if exists profiles_notify_pending on public.profiles;
create constraint trigger profiles_notify_pending after insert on public.profiles
deferrable initially deferred for each row execute function public.notify_admins_pending();
-- END SIGNUP TRIGGERS

create or replace function public.ping() returns timestamptz
language sql stable as $$ select now() $$;
grant execute on function public.ping() to anon, authenticated;
