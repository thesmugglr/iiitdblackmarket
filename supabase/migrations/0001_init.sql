-- IIITD Black Market schema. Run in the Supabase SQL editor or via `supabase db push`.

create extension if not exists pgcrypto;

-- ───────── Profiles & student eligibility ─────────
create table public.student_roster (
  email text primary key check (email = lower(email))
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  batch text,
  role text not null default 'student' check (role in ('student','admin')),
  status text not null default 'pending' check (status in ('pending','approved','suspended')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(new.email);
begin
  -- Server-side institute-domain check (the domain alone does NOT make someone a student).
  if v_email is null or v_email not like '%@iiitd.ac.in' then
    raise exception 'Only @iiitd.ac.in accounts are allowed';
  end if;
  insert into public.profiles (id, email, display_name, status)
  values (
    new.id, v_email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(v_email,'@',1)),
    case when exists (select 1 from public.student_roster r where r.email = v_email)
         then 'approved' else 'pending' end
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and status = 'approved');
$$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and status = 'approved');
$$;

-- Users may edit only display_name / batch of their own profile.
create or replace function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    if new.role <> old.role or new.status <> old.status or new.email <> old.email or new.id <> old.id then
      raise exception 'Not allowed to change role, status or email';
    end if;
  end if;
  return new;
end $$;
create trigger guard_profile before update on public.profiles
for each row execute function public.guard_profile_update();

-- ───────── Listings ─────────
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  description text not null default '' check (char_length(description) <= 4000),
  listing_type text not null check (listing_type in ('sale','rent','giveaway')),
  category text not null check (category in ('electronics','books','hostel','furniture','cycles','clothing','sports','misc')),
  condition text not null check (condition in ('new','like_new','good','fair')),
  price_inr integer not null default 0 check (price_inr >= 0),
  negotiable boolean not null default false,
  pickup_area text,
  rental_period text,
  deposit_inr integer check (deposit_inr >= 0),
  photos text[] not null default '{}' check (array_length(photos,1) is null or array_length(photos,1) <= 6),
  status text not null default 'active' check (status in ('active','reserved','sold','removed')),
  created_at timestamptz not null default now(),
  check (listing_type <> 'giveaway' or price_inr = 0)
);
create index listings_feed on public.listings (status, created_at desc);
create index listings_seller on public.listings (seller_id);

create table public.saved_items (
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  primary key (user_id, listing_id)
);

-- ───────── Chat ─────────
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (listing_id, buyer_id),
  check (buyer_id <> seller_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 2000),
  image_path text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (char_length(body) > 0 or image_path is not null)
);
create index messages_conv on public.messages (conversation_id, created_at);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  amount_inr integer not null check (amount_inr >= 0),
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now()
);

-- ───────── Moderation ─────────
create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete cascade,
  message_id uuid references public.messages(id) on delete set null,
  reason text not null check (char_length(reason) between 3 and 1000),
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at timestamptz not null default now(),
  check (listing_id is not null or message_id is not null)
);

-- ───────── Helper: conversation participant check ─────────
create or replace function public.in_conversation(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from conversations c
    where c.id = cid and auth.uid() in (c.buyer_id, c.seller_id));
$$;

-- ───────── Row level security ─────────
alter table public.student_roster enable row level security;
alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.saved_items enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.offers enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;

create policy roster_admin on public.student_roster for all using (public.is_admin()) with check (public.is_admin());

create policy profiles_read on public.profiles for select
  using (id = auth.uid() or public.is_member() or public.is_admin());
create policy profiles_update_self on public.profiles for update
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

create policy listings_read on public.listings for select
  using ((public.is_member() and (status <> 'removed' or seller_id = auth.uid())) or public.is_admin());
create policy listings_insert on public.listings for insert
  with check (public.is_member() and seller_id = auth.uid());
create policy listings_update on public.listings for update
  using ((seller_id = auth.uid() and public.is_member()) or public.is_admin())
  with check ((seller_id = auth.uid() and status <> 'removed') or public.is_admin());
create policy listings_delete on public.listings for delete
  using ((seller_id = auth.uid() and public.is_member()) or public.is_admin());

create policy saved_all on public.saved_items for all
  using (user_id = auth.uid() and public.is_member()) with check (user_id = auth.uid() and public.is_member());

create policy conv_read on public.conversations for select
  using (auth.uid() in (buyer_id, seller_id) or public.is_admin());
-- conversations are created through start_conversation()

create policy msg_read on public.messages for select
  using (public.in_conversation(conversation_id) or public.is_admin());
create policy msg_insert on public.messages for insert
  with check (sender_id = auth.uid() and public.is_member() and public.in_conversation(conversation_id)
    and not exists (select 1 from conversations c
      join blocks b on (b.blocker_id = c.buyer_id and b.blocked_id = c.seller_id)
                    or (b.blocker_id = c.seller_id and b.blocked_id = c.buyer_id)
      where c.id = conversation_id));

create policy offers_read on public.offers for select
  using (public.in_conversation(conversation_id) or public.is_admin());

create policy blocks_all on public.blocks for all
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

create policy reports_insert on public.reports for insert
  with check (reporter_id = auth.uid() and public.is_member());
create policy reports_read on public.reports for select
  using (reporter_id = auth.uid() or public.is_admin());
create policy reports_admin_update on public.reports for update
  using (public.is_admin()) with check (public.is_admin());

-- ───────── RPCs (the only write path for conversations, offers, read receipts) ─────────
create or replace function public.start_conversation(p_listing uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare l listings; cid uuid;
begin
  if not public.is_member() then raise exception 'Not an approved member'; end if;
  select * into l from listings where id = p_listing and status in ('active','reserved');
  if not found then raise exception 'Listing unavailable'; end if;
  if l.seller_id = auth.uid() then raise exception 'Cannot message yourself'; end if;
  if exists (select 1 from blocks where (blocker_id = l.seller_id and blocked_id = auth.uid())) then
    raise exception 'Unable to contact this seller';
  end if;
  insert into conversations (listing_id, buyer_id, seller_id) values (p_listing, auth.uid(), l.seller_id)
  on conflict (listing_id, buyer_id) do nothing;
  select id into cid from conversations where listing_id = p_listing and buyer_id = auth.uid();
  return cid;
end $$;

create or replace function public.make_offer(p_conversation uuid, p_amount integer) returns uuid
language plpgsql security definer set search_path = public as $$
declare c conversations; l listings; oid uuid;
begin
  select * into c from conversations where id = p_conversation and buyer_id = auth.uid();
  if not found then raise exception 'Only the buyer can make an offer'; end if;
  select * into l from listings where id = c.listing_id;
  if l.status <> 'active' or l.listing_type = 'giveaway' then raise exception 'Offers not possible'; end if;
  insert into offers (conversation_id, listing_id, buyer_id, amount_inr) values (c.id, c.listing_id, c.buyer_id, p_amount)
  returning id into oid;
  insert into messages (conversation_id, sender_id, body) values (c.id, auth.uid(), 'Made an offer of ₹' || p_amount);
  return oid;
end $$;

create or replace function public.respond_offer(p_offer uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare o offers; c conversations;
begin
  select * into o from offers where id = p_offer and status = 'pending';
  if not found then raise exception 'Offer not pending'; end if;
  select * into c from conversations where id = o.conversation_id and seller_id = auth.uid();
  if not found then raise exception 'Only the seller can respond'; end if;
  update offers set status = case when p_accept then 'accepted' else 'declined' end where id = p_offer;
  if p_accept then
    update listings set status = 'reserved', price_inr = o.amount_inr where id = o.listing_id and status = 'active';
    update offers set status = 'declined' where listing_id = o.listing_id and status = 'pending' and id <> p_offer;
  end if;
  insert into messages (conversation_id, sender_id, body)
  values (o.conversation_id, auth.uid(), case when p_accept then 'Accepted the offer of ₹' else 'Declined the offer of ₹' end || o.amount_inr);
end $$;

create or replace function public.mark_read(p_conversation uuid) returns void
language sql security definer set search_path = public as $$
  update messages set read_at = now()
  where conversation_id = p_conversation and sender_id <> auth.uid() and read_at is null
    and public.in_conversation(p_conversation);
$$;

create or replace function public.unread_counts() returns table (conversation_id uuid, unread bigint)
language sql stable security definer set search_path = public as $$
  select m.conversation_id, count(*) from messages m
  join conversations c on c.id = m.conversation_id
  where auth.uid() in (c.buyer_id, c.seller_id) and m.sender_id <> auth.uid() and m.read_at is null
  group by m.conversation_id;
$$;

-- Admin: moderation helpers
create or replace function public.admin_set_status(p_user uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  update profiles set status = p_status where id = p_user;
end $$;

-- ───────── Storage ─────────
insert into storage.buckets (id, name, public) values
  ('listing-photos','listing-photos', false),
  ('chat-attachments','chat-attachments', false)
on conflict do nothing;

-- listing photos: path = <uid>/<file>; members read, owner writes
create policy lp_read on storage.objects for select
  using (bucket_id = 'listing-photos' and public.is_member());
create policy lp_write on storage.objects for insert
  with check (bucket_id = 'listing-photos' and public.is_member() and (storage.foldername(name))[1] = auth.uid()::text);
create policy lp_delete on storage.objects for delete
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- chat attachments: path = <conversation_id>/<file>; participants only
create policy ca_read on storage.objects for select
  using (bucket_id = 'chat-attachments' and public.in_conversation(((storage.foldername(name))[1])::uuid));
create policy ca_write on storage.objects for insert
  with check (bucket_id = 'chat-attachments' and public.in_conversation(((storage.foldername(name))[1])::uuid));

-- Realtime
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.offers;

-- Bootstrap an admin manually after that person signs in once:
--   update public.profiles set role='admin', status='approved' where email='someone@iiitd.ac.in';
