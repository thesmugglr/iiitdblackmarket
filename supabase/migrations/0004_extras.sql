-- EXTRA-01..03: "looking for" posts, moving-out bundles, expiry and in-app notifications.
-- Apply after 0001_init.sql and 0002_review_access.sql.

-- ───────── Listing expiry ─────────
alter table public.listings add column expires_at timestamptz not null default (now() + interval '30 days');
alter table public.listings add column expiry_reminded boolean not null default false;

drop policy listings_read on public.listings;
create policy listings_read on public.listings for select
  using ((public.is_member() and (status <> 'removed' or seller_id = auth.uid())
          and (expires_at > now() or seller_id = auth.uid())) or public.is_admin());

-- ───────── Notifications ─────────
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('message','wanted','expiry')),
  title text not null check (char_length(title) <= 200),
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
create policy notif_read on public.notifications for select using (user_id = auth.uid() and public.is_member());
create policy notif_update on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.notifications from public, anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

create or replace function public.notify(p_user uuid, p_kind text, p_title text, p_link text) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- One unread notification per destination; avoids a flood from chatty conversations.
  if exists (select 1 from notifications where user_id = p_user and link = p_link and kind = p_kind and read_at is null) then
    return;
  end if;
  insert into notifications (user_id, kind, title, link) values (p_user, p_kind, left(p_title, 200), p_link);
end $$;
revoke execute on function public.notify(uuid, text, text, text) from public, anon, authenticated;

create or replace function public.notify_new_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare c conversations; t text;
begin
  select * into c from conversations where id = new.conversation_id;
  select title into t from listings where id = c.listing_id;
  perform public.notify(case when new.sender_id = c.buyer_id then c.seller_id else c.buyer_id end,
    'message', 'New message about ' || coalesce(t, 'a listing'), '/inbox/' || c.id);
  return new;
end $$;
create trigger messages_notify after insert on public.messages
for each row execute function public.notify_new_message();

create or replace function public.mark_all_notifications_read() returns void
language sql security definer set search_path = public as $$
  update notifications set read_at = now() where user_id = auth.uid() and read_at is null and public.is_member();
$$;

create or replace function public.refresh_expiry_notices() returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if not public.is_member() then return; end if;
  for r in
    select id, title from listings
    where seller_id = auth.uid() and status in ('active','reserved')
      and expires_at > now() and expires_at < now() + interval '3 days' and not expiry_reminded
  loop
    update listings set expiry_reminded = true where id = r.id;
    perform public.notify(auth.uid(), 'expiry', '"' || r.title || '" expires soon. Renew it to keep it listed.', '/listing/' || r.id);
  end loop;
end $$;

create or replace function public.renew_listing(p_listing uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update listings set expires_at = now() + interval '30 days', expiry_reminded = false
  where id = p_listing and seller_id = auth.uid() and public.is_member() and status in ('active','reserved');
  if not found then raise exception 'Listing cannot be renewed'; end if;
end $$;

-- ───────── "Looking for" posts ─────────
create table public.wanted_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  category text not null check (category in ('electronics','books','hostel','furniture','cycles','clothing','sports','misc')),
  max_price_inr integer check (max_price_inr >= 0),
  status text not null default 'open' check (status in ('open','fulfilled','closed')),
  created_at timestamptz not null default now()
);
create table public.wanted_responses (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.wanted_posts(id) on delete cascade,
  responder_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, listing_id)
);
alter table public.wanted_posts enable row level security;
alter table public.wanted_responses enable row level security;
create policy wanted_read on public.wanted_posts for select
  using ((public.is_member() and (status = 'open' or user_id = auth.uid())) or public.is_admin());
create policy wanted_insert on public.wanted_posts for insert
  with check (public.is_member() and user_id = auth.uid());
create policy wanted_update on public.wanted_posts for update
  using ((user_id = auth.uid() and public.is_member()) or public.is_admin())
  with check ((user_id = auth.uid() and public.is_member()) or public.is_admin());
create policy wanted_delete on public.wanted_posts for delete
  using ((user_id = auth.uid() and public.is_member()) or public.is_admin());
create policy wresp_read on public.wanted_responses for select
  using (responder_id = auth.uid() or exists (select 1 from wanted_posts p where p.id = post_id and p.user_id = auth.uid()));

create or replace function public.respond_wanted(p_post uuid, p_listing uuid) returns void
language plpgsql security definer set search_path = public as $$
declare p wanted_posts; l listings;
begin
  if not public.is_member() then raise exception 'Not an approved member'; end if;
  select * into p from wanted_posts where id = p_post and status = 'open';
  if not found then raise exception 'Post is not open'; end if;
  if p.user_id = auth.uid() then raise exception 'Cannot respond to your own post'; end if;
  select * into l from listings where id = p_listing and seller_id = auth.uid() and status = 'active' and expires_at > now();
  if not found then raise exception 'Choose one of your active listings'; end if;
  if exists (select 1 from blocks where (blocker_id = p.user_id and blocked_id = auth.uid())
                                     or (blocker_id = auth.uid() and blocked_id = p.user_id)) then
    raise exception 'Unable to respond to this post';
  end if;
  insert into wanted_responses (post_id, responder_id, listing_id) values (p_post, auth.uid(), p_listing)
    on conflict do nothing;
  perform public.notify(p.user_id, 'wanted', 'Someone has what you are looking for: "' || p.title || '"', '/listing/' || p_listing);
end $$;

-- ───────── Moving-out bundles ─────────
create table public.bundles (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  price_inr integer not null check (price_inr >= 0),
  status text not null default 'active' check (status in ('active','sold','removed')),
  created_at timestamptz not null default now()
);
create table public.bundle_items (
  bundle_id uuid not null references public.bundles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  primary key (bundle_id, listing_id)
);
alter table public.bundles enable row level security;
alter table public.bundle_items enable row level security;
create policy bundles_read on public.bundles for select
  using ((public.is_member() and (status <> 'removed' or seller_id = auth.uid())) or public.is_admin());
create policy bundles_update on public.bundles for update
  using ((seller_id = auth.uid() and public.is_member() and status <> 'removed') or public.is_admin())
  with check ((seller_id = auth.uid() and public.is_member() and status <> 'removed') or public.is_admin());
create policy bundles_delete on public.bundles for delete
  using ((seller_id = auth.uid() and public.is_member()) or public.is_admin());
create policy bitems_read on public.bundle_items for select
  using (exists (select 1 from bundles b where b.id = bundle_id));

create or replace function public.create_bundle(p_title text, p_description text, p_price integer, p_listings uuid[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare bid uuid; n integer;
begin
  if not public.is_member() then raise exception 'Not an approved member'; end if;
  if p_price is null or p_price < 0 then raise exception 'Invalid price'; end if;
  select count(distinct id) into n from listings
    where id = any(p_listings) and seller_id = auth.uid() and status = 'active' and expires_at > now();
  if n < 2 or n > 10 or n <> (select count(distinct x) from unnest(p_listings) x) then
    raise exception 'A bundle needs 2 to 10 of your own active listings';
  end if;
  insert into bundles (seller_id, title, description, price_inr) values (auth.uid(), p_title, coalesce(p_description, ''), p_price)
    returning id into bid;
  insert into bundle_items (bundle_id, listing_id) select bid, x from (select distinct unnest(p_listings) x) s;
  return bid;
end $$;

create or replace function public.mark_bundle_sold(p_bundle uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update bundles set status = 'sold' where id = p_bundle and seller_id = auth.uid() and public.is_member() and status = 'active';
  if not found then raise exception 'Bundle cannot be marked sold'; end if;
  update listings set status = 'sold'
  where id in (select listing_id from bundle_items where bundle_id = p_bundle) and seller_id = auth.uid() and status in ('active','reserved');
end $$;

alter publication supabase_realtime add table public.notifications;
