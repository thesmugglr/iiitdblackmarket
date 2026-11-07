-- Emoji reactions and replies on chat messages, and sending a listing to another member inside the app.
-- A listing sent to someone you have never talked to opens a direct chat as a message request:
-- they see it under Requests and choose Accept or Decline before either side can keep talking.

-- ───────── Direct chats and message requests ─────────
-- kind 'listing': the existing buyer/seller chat about one listing.
-- kind 'direct': a person-to-person chat; buyer_id is the person who started it, seller_id the recipient.
alter table public.conversations alter column listing_id drop not null;
alter table public.conversations add column kind text not null default 'listing' check (kind in ('listing','direct'));
alter table public.conversations add column request_status text not null default 'accepted'
  check (request_status in ('pending','accepted','declined'));
alter table public.conversations add constraint conversations_kind_shape
  check ((kind = 'listing' and listing_id is not null) or (kind = 'direct' and listing_id is null));
create unique index conversations_direct_pair on public.conversations
  (least(buyer_id, seller_id), greatest(buyer_id, seller_id)) where kind = 'direct';

-- A message can carry a listing card. The text stays if the listing is later deleted.
alter table public.messages add column shared_listing_id uuid references public.listings(id) on delete set null;

-- Sending is allowed in accepted chats; in a pending request only the person who started it may send.
create or replace function public.can_message(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.in_conversation(cid) and exists (
    select 1 from conversations c
    join profiles buyer on buyer.id = c.buyer_id and buyer.status = 'approved'
    join profiles seller on seller.id = c.seller_id and seller.status = 'approved'
    where c.id = cid
      and (c.request_status = 'accepted' or (c.request_status = 'pending' and c.buyer_id = auth.uid()))
      and not exists (select 1 from blocks b
      where (b.blocker_id = c.buyer_id and b.blocked_id = c.seller_id)
         or (b.blocker_id = c.seller_id and b.blocked_id = c.buyer_id))
  );
$$;

-- Replies quote an earlier message of the same chat (WhatsApp-style). Deleting the original keeps the reply.
alter table public.messages add column reply_to_id uuid references public.messages(id) on delete set null;

-- A message may only point at a listing its sender can see, and reply only within its own chat.
drop policy msg_insert on public.messages;
create policy msg_insert on public.messages for insert
  with check (sender_id = auth.uid() and public.can_message(conversation_id)
    and (shared_listing_id is null or exists (select 1 from listings l
      where l.id = shared_listing_id and (l.status <> 'removed' or l.seller_id = auth.uid())))
    and (reply_to_id is null or exists (select 1 from messages r
      where r.id = reply_to_id and r.conversation_id = messages.conversation_id)));

create or replace function public.share_listing(p_listing uuid, p_to uuid, p_note text default '') returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); l listings; c conversations; cid uuid; known boolean; note text := left(btrim(coalesce(p_note, '')), 500);
begin
  if not public.is_member() then raise exception 'Not an approved member'; end if;
  if p_to is null or p_to = me then raise exception 'Choose someone else to send this to'; end if;
  if not exists (select 1 from profiles where id = p_to and status = 'approved') then raise exception 'That person is not on The Smugglr'; end if;
  if exists (select 1 from blocks where (blocker_id = me and blocked_id = p_to) or (blocker_id = p_to and blocked_id = me)) then
    raise exception 'You cannot send this to that person';
  end if;
  select * into l from listings where id = p_listing and status in ('active','reserved','sold');
  if not found then raise exception 'Listing unavailable'; end if;

  perform pg_advisory_xact_lock(hashtextextended('direct:' || least(me, p_to)::text || ':' || greatest(me, p_to)::text, 0));
  select * into c from conversations where kind = 'direct'
    and least(buyer_id, seller_id) = least(me, p_to) and greatest(buyer_id, seller_id) = greatest(me, p_to);
  if not found then
    -- No request needed when the two have already talked: the recipient has sent the sender a message before.
    known := exists (select 1 from conversations x join messages m on m.conversation_id = x.id and m.sender_id = p_to
      where (x.buyer_id = me and x.seller_id = p_to) or (x.buyer_id = p_to and x.seller_id = me));
    insert into conversations (kind, listing_id, buyer_id, seller_id, request_status)
      values ('direct', null, me, p_to, case when known then 'accepted' else 'pending' end)
      returning * into c;
  elsif c.request_status <> 'accepted' then
    if c.seller_id = me then
      -- Writing back to someone whose request you had not accepted counts as accepting it.
      update conversations set request_status = 'accepted' where id = c.id returning * into c;
    elsif c.request_status = 'declined' then
      raise exception 'They are not accepting messages from you';
    end if;
  end if;
  cid := c.id;
  insert into messages (conversation_id, sender_id, body, shared_listing_id)
    values (cid, me, case when note = '' then 'Shared a listing: ' || l.title else note end, l.id);
  return cid;
end $$;
revoke all on function public.share_listing(uuid, uuid, text) from public, anon;
grant execute on function public.share_listing(uuid, uuid, text) to authenticated;

create or replace function public.respond_request(p_conversation uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member() then raise exception 'Not an approved member'; end if;
  update conversations set request_status = case when p_accept then 'accepted' else 'declined' end
   where id = p_conversation and kind = 'direct' and seller_id = auth.uid() and request_status <> 'accepted';
  if not found then raise exception 'This request is no longer waiting for you'; end if;
  if not p_accept then
    update notifications set read_at = now()
     where user_id = auth.uid() and link = '/inbox/' || p_conversation::text and read_at is null;
  end if;
end $$;
revoke all on function public.respond_request(uuid, boolean) from public, anon;
grant execute on function public.respond_request(uuid, boolean) to authenticated;

-- Bell and push text for direct chats names the person instead of a listing.
create or replace function public.notify_new_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare c conversations; t text; who text;
begin
  select * into c from conversations where id = new.conversation_id;
  if c.kind = 'direct' then
    select display_name into who from profiles where id = new.sender_id;
    perform public.notify(case when new.sender_id = c.buyer_id then c.seller_id else c.buyer_id end, 'message',
      case when c.request_status = 'pending' then 'Message request from ' else 'New message from ' end || coalesce(who, 'a student'),
      '/inbox/' || c.id);
  else
    select title into t from listings where id = c.listing_id;
    perform public.notify(case when new.sender_id = c.buyer_id then c.seller_id else c.buyer_id end,
      'message', 'New message about ' || coalesce(t, 'a listing'), '/inbox/' || c.id);
  end if;
  return new;
end $$;

-- ───────── Reactions ─────────
-- One reaction per person per message. Removing a reaction sets emoji to null instead of deleting the row,
-- so every change is an insert or update that realtime can filter by conversation (deletes cannot be filtered).
create table public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  emoji text check (emoji in ('❤️','😂','😮','😢','😡','👍','🔥')),
  updated_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
create index message_reactions_conv on public.message_reactions (conversation_id);
alter table public.message_reactions enable row level security;

create policy reactions_read on public.message_reactions for select
  using (public.in_conversation(conversation_id) or public.is_admin());
create policy reactions_insert on public.message_reactions for insert
  with check (user_id = auth.uid() and public.can_message(conversation_id)
    and exists (select 1 from messages m where m.id = message_id and m.conversation_id = message_reactions.conversation_id));
create policy reactions_update on public.message_reactions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.can_message(conversation_id)
    and exists (select 1 from messages m where m.id = message_id and m.conversation_id = message_reactions.conversation_id));
revoke delete, truncate on public.message_reactions from anon, authenticated;

alter publication supabase_realtime add table public.message_reactions;
