-- Cookie-free visit counter: one row per day (India time) with how many devices opened the site that day and
-- how many of them were new. No IP address, user id or device id is stored. Only admins can read the numbers.
create table public.site_visits (
  day date primary key,
  visitors integer not null default 0,
  new_devices integer not null default 0
);
alter table public.site_visits enable row level security;
revoke all on public.site_visits from public, anon, authenticated;

-- Called by the site at most once per device per day. Anyone may call it (the landing page is public); it can
-- only add to today's two counters.
create or replace function public.record_visit(p_new_device boolean default false) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.site_visits (day, visitors, new_devices)
  values ((now() at time zone 'Asia/Kolkata')::date, 1, case when coalesce(p_new_device, false) then 1 else 0 end)
  on conflict (day) do update
    set visitors = public.site_visits.visitors + 1,
        new_devices = public.site_visits.new_devices + excluded.new_devices;
end $$;
revoke all on function public.record_visit(boolean) from public;
grant execute on function public.record_visit(boolean) to anon, authenticated;

-- The last 90 days, newest first. Returns nothing unless the caller is an approved admin.
create or replace function public.visit_summary() returns table (day date, visitors integer, new_devices integer)
language sql stable security definer set search_path = public as $$
  select v.day, v.visitors, v.new_devices from public.site_visits v where public.is_admin() order by v.day desc limit 90;
$$;
revoke all on function public.visit_summary() from public, anon;
grant execute on function public.visit_summary() to authenticated;
