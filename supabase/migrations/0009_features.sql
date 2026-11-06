-- Owner-requested features (2026-11-06). Apply after 0008_offer_retries.sql.
--   * Push notifications to phones: browser subscriptions plus a database trigger that asks the `push` Edge
--     Function to deliver each new notification (docs/push-notifications.md).
--   * Delete my account.
--   * Price-drop and sold/reserved alerts for saved items.
--   * Mark an item sold to a specific buyer from the chat, and the buyer's thumbs-up ("smooth deals").
--   * A lost & found board with private replies.

-- ───────── Notification kinds ─────────
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('message','wanted','expiry','approval','price_drop','saved_sold','lost_found'));

-- ───────── Deals and thumbs-up ─────────
-- One row per item a seller marked sold to a particular buyer. It outlives the listing and the conversation so a
-- seller keeps their record; if the buyer deletes their account the rating stays without the link to them.
create table public.deals (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  buyer_id uuid references public.profiles(id) on delete set null,
  title text not null check (char_length(title) <= 120),
  amount_inr integer check (amount_inr >= 0),
  smooth boolean,                 -- the buyer's answer to "did it go smoothly?"; null until they answer
  rated_at timestamptz,
  created_at timestamptz not null default now(),
  check (seller_id <> buyer_id)
);
create unique index deals_one_per_listing on public.deals (listing_id) where listing_id is not null;
create index deals_smooth_by_seller on public.deals (seller_id) where smooth;
alter table public.deals enable row level security;
create policy deals_read on public.deals for select
  using ((public.is_member() and auth.uid() in (seller_id, buyer_id)) or public.is_admin());
revoke insert, update, delete on public.deals from public, anon, authenticated;

create or replace function public.mark_sold_to(p_conversation uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare c conversations; l listings; d uuid; agreed integer;
begin
  if not public.can_message(p_conversation) then raise exception 'Conversation unavailable'; end if;
  select * into c from conversations where id = p_conversation and seller_id = auth.uid();
  if not found then raise exception 'Only the seller can mark this sold'; end if;
  -- Same listing-first lock order as the offer functions.
  select * into l from listings where id = c.listing_id for update;
  if not found or l.status not in ('active','reserved') then raise exception 'This listing cannot be marked sold'; end if;
  if exists (select 1 from deals where listing_id = l.id) then raise exception 'This listing is already marked sold'; end if;
  select amount_inr into agreed from offers
   where listing_id = l.id and buyer_id = c.buyer_id and status = 'accepted' order by created_at desc limit 1;
  insert into deals (listing_id, conversation_id, seller_id, buyer_id, title, amount_inr)
    values (l.id, c.id, c.seller_id, c.buyer_id, l.title, coalesce(agreed, l.price_inr))
    returning id into d;
  update listings set status = 'sold' where id = l.id;
  update offers set status = 'declined' where listing_id = l.id and status = 'pending';
  insert into messages (conversation_id, sender_id, body)
    values (c.id, auth.uid(), 'Marked this as sold to you. If the deal went smoothly, give it a thumbs-up here.');
  return d;
end $$;

create or replace function public.rate_deal(p_conversation uuid, p_smooth boolean) returns void
language plpgsql security definer set search_path = public as $$
declare d deals;
begin
  if not public.is_member() then raise exception 'Not an approved member'; end if;
  if p_smooth is null then raise exception 'Choose yes or no'; end if;
  select * into d from deals where conversation_id = p_conversation and buyer_id = auth.uid() for update;
  if not found then raise exception 'There is no deal to rate here'; end if;
  if d.smooth is not null then
    if d.smooth = p_smooth then return; end if; -- a retried tap after a lost reply
    raise exception 'You already rated this deal';
  end if;
  update deals set smooth = p_smooth, rated_at = now() where id = d.id;
end $$;

-- What other students see: how many buyers said a seller's deals went smoothly.
create or replace function public.smooth_deals(p_seller uuid) returns integer
language sql stable security definer set search_path = public as $$
  select case when public.is_member() then (select count(*)::integer from deals where seller_id = p_seller and smooth) else 0 end
$$;

revoke all on function public.mark_sold_to(uuid) from public, anon, authenticated;
revoke all on function public.rate_deal(uuid, boolean) from public, anon, authenticated;
revoke all on function public.smooth_deals(uuid) from public, anon, authenticated;
grant execute on function public.mark_sold_to(uuid) to authenticated;
grant execute on function public.rate_deal(uuid, boolean) to authenticated;
grant execute on function public.smooth_deals(uuid) to authenticated;

-- ───────── Saved-item alerts ─────────
create or replace function public.notify_savers() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.status = 'active' and old.status = 'active' and new.price_inr < old.price_inr then
    for r in select s.user_id from saved_items s where s.listing_id = new.id and s.user_id <> new.seller_id loop
      perform public.notify(r.user_id, 'price_drop', '"' || new.title || '" dropped to ₹' || new.price_inr, '/listing/' || new.id);
    end loop;
  elsif old.status = 'active' and new.status in ('reserved','sold') then
    -- The buyer who got it does not need to hear that it is gone.
    for r in select s.user_id from saved_items s
             where s.listing_id = new.id and s.user_id <> new.seller_id
               and not exists (select 1 from offers o where o.listing_id = new.id and o.status = 'accepted' and o.buyer_id = s.user_id)
               and not exists (select 1 from deals d where d.listing_id = new.id and d.buyer_id = s.user_id)
    loop
      perform public.notify(r.user_id, 'saved_sold',
        '"' || new.title || '" was just ' || case when new.status = 'sold' then 'sold' else 'reserved' end, '/listing/' || new.id);
    end loop;
  end if;
  return new;
end $$;
create trigger listings_notify_savers after update of price_inr, status on public.listings
for each row execute function public.notify_savers();

-- ───────── Lost & found ─────────
create table public.lost_found (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('lost','found')),
  title text not null check (char_length(title) between 3 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  place text not null check (char_length(trim(place)) between 2 and 120), -- where it was lost or found (required)
  photo text,
  status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now(),
  check (photo is null or photo like (user_id::text || '/%'))
);
create index lost_found_feed on public.lost_found (status, created_at desc);
alter table public.lost_found enable row level security;
create policy lf_read on public.lost_found for select
  using ((public.is_member() and (status = 'open' or user_id = auth.uid())) or public.is_admin());
create policy lf_insert on public.lost_found for insert
  with check (public.is_member() and user_id = auth.uid());
create policy lf_update on public.lost_found for update
  using ((user_id = auth.uid() and public.is_member()) or public.is_admin())
  with check ((user_id = auth.uid() and public.is_member()) or public.is_admin());
create policy lf_delete on public.lost_found for delete
  using ((user_id = auth.uid() and public.is_member()) or public.is_admin());

-- Replies are private between the poster and each person who writes to them.
create table public.lost_found_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.lost_found(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);
create index lost_found_replies_post on public.lost_found_replies (post_id, created_at);
alter table public.lost_found_replies enable row level security;
create policy lfr_read on public.lost_found_replies for select
  using ((public.is_member() and auth.uid() in (sender_id, recipient_id)) or public.is_admin());
revoke insert, update, delete on public.lost_found_replies from public, anon, authenticated;

create or replace function public.reply_lost_found(p_post uuid, p_body text, p_to uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare p lost_found; v_to uuid; v_body text := trim(coalesce(p_body, '')); rid uuid;
begin
  if not public.is_member() then raise exception 'Not an approved member'; end if;
  select * into p from lost_found where id = p_post and status = 'open';
  if not found then raise exception 'This post is closed'; end if;
  if p.user_id = auth.uid() then
    -- The poster answers someone who has already written to them about this post.
    if p_to is null or not exists (select 1 from lost_found_replies r
                                   where r.post_id = p_post and r.sender_id = p_to and r.recipient_id = auth.uid()) then
      raise exception 'Choose who to reply to';
    end if;
    v_to := p_to;
  else
    v_to := p.user_id;
  end if;
  if char_length(v_body) = 0 then raise exception 'Write a message first'; end if;
  if not exists (select 1 from profiles where id = v_to and status = 'approved')
     or exists (select 1 from blocks where (blocker_id = v_to and blocked_id = auth.uid())
                                       or (blocker_id = auth.uid() and blocked_id = v_to)) then
    raise exception 'Unable to reply';
  end if;
  insert into lost_found_replies (post_id, sender_id, recipient_id, body) values (p_post, auth.uid(), v_to, left(v_body, 1000))
    returning id into rid;
  perform public.notify(v_to, 'lost_found', 'New reply about "' || p.title || '"', '/lost-found?post=' || p_post);
  return rid;
end $$;
revoke all on function public.reply_lost_found(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.reply_lost_found(uuid, text, uuid) to authenticated;

-- ───────── Delete my account ─────────
-- Photos are removed by the app first through the Storage API (Storage refuses direct SQL deletes). Everything
-- else the person owns references their profile with on delete cascade.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first'; end if;
  -- A report about a message (and no listing) would otherwise break its own check once the message goes.
  delete from reports r using messages m, conversations c
   where r.message_id = m.id and r.listing_id is null and c.id = m.conversation_id and me in (c.buyer_id, c.seller_id);
  delete from auth.users where id = me;
end $$;
revoke all on function public.delete_my_account() from public, anon, authenticated;
grant execute on function public.delete_my_account() to authenticated;

-- ───────── Push notifications ─────────
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 80 and 100),
  auth text not null check (char_length(auth) between 16 and 30),
  created_at timestamptz not null default now()
);
create index push_subscriptions_user on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy push_read_own on public.push_subscriptions for select using (user_id = auth.uid());
revoke insert, update, delete on public.push_subscriptions from public, anon, authenticated;

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member() then raise exception 'Not an approved member'; end if;
  -- One browser has one owner: signing in as someone else on the same phone moves its subscription.
  delete from push_subscriptions where endpoint = p_endpoint;
  insert into push_subscriptions (user_id, endpoint, p256dh, auth) values (auth.uid(), p_endpoint, p_p256dh, p_auth);
end $$;
create or replace function public.remove_push_subscription(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

-- Single private row. The secret is generated here and only ever leaves in the trigger's request header; the
-- Edge Function never stores it and hands it back to push_payload()/push_prune(), which check it. The public
-- key and function URL are set after the function is deployed (docs/push-notifications.md).
create table public.push_config (
  id boolean primary key default true check (id),
  function_url text check (function_url like 'https://%'),
  vapid_public_key text,
  secret text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
);
alter table public.push_config enable row level security;
revoke all on public.push_config from public, anon, authenticated;
insert into public.push_config default values on conflict do nothing;

create or replace function public.push_public_key() returns text
language sql stable security definer set search_path = public as $$
  select case when public.is_member() then (select vapid_public_key from push_config where id and function_url is not null) end
$$;

create or replace function public.push_payload(p_notification uuid, p_secret text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare n notifications;
begin
  if p_secret is null or p_secret is distinct from (select secret from push_config where id) then raise exception 'Not allowed'; end if;
  select * into n from notifications where id = p_notification;
  if not found then return null; end if;
  return jsonb_build_object('title', n.title, 'link', n.link, 'kind', n.kind,
    'subscriptions', coalesce((select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
                               from push_subscriptions s where s.user_id = n.user_id), '[]'::jsonb));
end $$;

create or replace function public.push_prune(p_secret text, p_endpoints text[]) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if p_secret is null or p_secret is distinct from (select secret from push_config where id) then raise exception 'Not allowed'; end if;
  delete from push_subscriptions where endpoint = any(p_endpoints);
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.save_push_subscription(text, text, text) from public, anon, authenticated;
revoke all on function public.remove_push_subscription(text) from public, anon, authenticated;
revoke all on function public.push_public_key() from public, anon, authenticated;
revoke all on function public.push_payload(uuid, text) from public, anon, authenticated;
revoke all on function public.push_prune(text, text[]) from public, anon, authenticated;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;
grant execute on function public.remove_push_subscription(text) to authenticated;
grant execute on function public.push_public_key() to authenticated;
-- The Edge Function calls these with the public API key; the secret is what authorises it.
grant execute on function public.push_payload(uuid, text) to anon;
grant execute on function public.push_prune(text, text[]) to anon;

-- pg_net lets the database make the HTTP request without waiting for it.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
  end if;
exception when others then
  raise notice 'pg_net is not available here, so push notifications stay off';
end $$;

create or replace function public.send_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare cfg push_config;
begin
  select * into cfg from push_config where id;
  if cfg.function_url is null
     or not exists (select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'net' and p.proname = 'http_post')
     or not exists (select 1 from push_subscriptions where user_id = new.user_id) then
    return new;
  end if;
  begin
    perform net.http_post(
      url := cfg.function_url,
      body := jsonb_build_object('notification_id', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', cfg.secret),
      timeout_milliseconds := 8000);
  exception when others then
    null; -- a push problem must never stop the in-app notification from being saved
  end;
  return new;
end $$;
create trigger notifications_push after insert on public.notifications
for each row execute function public.send_push();
