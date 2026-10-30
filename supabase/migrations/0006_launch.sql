-- Launch readiness. Apply after 0005_expiry_access.sql.
-- 1. First-admin bootstrap that needs no SQL after the owner's first sign-in.
-- 2. Admins are notified when someone new is waiting for approval.
-- 3. A trivial public function the host can call to keep a free-tier project active.

-- Emails listed here become approved admins on their first sign-in. Managed in the trusted SQL
-- editor or by the deployer; row level security with no policies keeps it closed to every API role.
create table public.admin_bootstrap (
  email text primary key check (email = lower(email) and email like '%@iiitd.ac.in')
);
alter table public.admin_bootstrap enable row level security;
revoke all on public.admin_bootstrap from public, anon, authenticated;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('message','wanted','expiry','approval'));

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(new.email);
  -- GoTrue confirms an email after inserting the user, so the provider is the reliable signal at insert time.
  -- app_metadata can only be set server-side, never by the signing-up user.
  v_verified boolean := coalesce(new.raw_app_meta_data->>'provider', '') = 'google' or new.email_confirmed_at is not null;
  v_admin boolean;
  v_roster boolean;
  v_name text;
  r record;
begin
  -- Server-side institute-domain check (the domain alone does NOT make someone a student).
  if v_email is null or v_email not like '%@iiitd.ac.in' then
    raise exception 'Only @iiitd.ac.in accounts are allowed';
  end if;
  -- Roster and bootstrap-admin privileges only apply to emails verified by the identity provider (Google).
  v_admin := v_verified and exists (select 1 from public.admin_bootstrap b where b.email = v_email);
  v_roster := v_verified and exists (select 1 from public.student_roster s where s.email = v_email);
  v_name := coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), nullif(new.raw_user_meta_data->>'name', ''), split_part(v_email, '@', 1));
  insert into public.profiles (id, email, display_name, role, status)
  values (new.id, v_email, left(v_name, 80),
          case when v_admin then 'admin' else 'student' end,
          case when v_admin or v_roster then 'approved' else 'pending' end);
  if not (v_admin or v_roster) then
    for r in select id from public.profiles where role = 'admin' and status = 'approved' loop
      perform public.notify(r.id, 'approval', 'Someone new is waiting for your approval', '/admin');
    end loop;
  end if;
  return new;
end $$;

create or replace function public.ping() returns timestamptz
language sql stable as $$ select now() $$;
grant execute on function public.ping() to anon, authenticated;
