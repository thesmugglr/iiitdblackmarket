-- Review fixes. Apply after 0001_init.sql, including on fresh installations.
create or replace function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- SQL-editor/service administration only, not an unauthenticated API request.
  if auth.uid() is null and current_setting('role', true) in ('none','postgres','service_role') then
    return new;
  end if;
  if not public.is_admin() and (
    new.role is distinct from old.role or new.status is distinct from old.status
    or new.email is distinct from old.email or new.id is distinct from old.id
  ) then raise exception 'Not allowed to change role, status or email'; end if;
  return new;
end $$;

create or replace function public.unread_counts() returns table (conversation_id uuid, unread bigint)
language sql stable security definer set search_path = public as $$
  select m.conversation_id,count(*) from messages m
  join conversations c on c.id=m.conversation_id
  where public.is_member() and auth.uid() in (c.buyer_id,c.seller_id)
    and m.sender_id<>auth.uid() and m.read_at is null
  group by m.conversation_id;
$$;

create or replace function public.in_conversation(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_member() and exists (select 1 from conversations c
    where c.id = cid and auth.uid() in (c.buyer_id,c.seller_id));
$$;

-- Definer helper sees both directions of a block regardless of blocks-table RLS.
create or replace function public.can_message(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.in_conversation(cid) and exists (
    select 1 from conversations c
    join profiles buyer on buyer.id = c.buyer_id and buyer.status = 'approved'
    join profiles seller on seller.id = c.seller_id and seller.status = 'approved'
    where c.id = cid and not exists (select 1 from blocks b
      where (b.blocker_id = c.buyer_id and b.blocked_id = c.seller_id)
         or (b.blocker_id = c.seller_id and b.blocked_id = c.buyer_id))
  );
$$;

drop policy conv_read on public.conversations;
create policy conv_read on public.conversations for select
  using (public.in_conversation(id) or public.is_admin());
drop policy msg_insert on public.messages;
create policy msg_insert on public.messages for insert
  with check (sender_id = auth.uid() and public.can_message(conversation_id));
drop policy ca_write on storage.objects;
create policy ca_write on storage.objects for insert
  with check (bucket_id = 'chat-attachments' and public.can_message(((storage.foldername(name))[1])::uuid));

-- Owners cannot undo an administrator's removal.
drop policy listings_update on public.listings;
create policy listings_update on public.listings for update
  using ((seller_id = auth.uid() and public.is_member() and status <> 'removed') or public.is_admin())
  with check ((seller_id = auth.uid() and public.is_member() and status <> 'removed') or public.is_admin());

create or replace function public.start_conversation(p_listing uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare l listings; cid uuid;
begin
  if not public.is_member() then raise exception 'Not an approved member'; end if;
  select * into l from listings where id = p_listing and status in ('active','reserved');
  if not found then raise exception 'Listing unavailable'; end if;
  if l.seller_id = auth.uid() then raise exception 'Cannot message yourself'; end if;
  if not exists(select 1 from profiles where id = l.seller_id and status = 'approved')
    or exists(select 1 from blocks where
      (blocker_id = l.seller_id and blocked_id = auth.uid())
      or (blocker_id = auth.uid() and blocked_id = l.seller_id)) then
    raise exception 'Unable to contact this seller';
  end if;
  insert into conversations (listing_id,buyer_id,seller_id) values (p_listing,auth.uid(),l.seller_id)
    on conflict (listing_id,buyer_id) do nothing;
  select id into cid from conversations where listing_id = p_listing and buyer_id = auth.uid();
  return cid;
end $$;

create or replace function public.make_offer(p_conversation uuid,p_amount integer) returns uuid
language plpgsql security definer set search_path = public as $$
declare c conversations; l listings; oid uuid;
begin
  if not public.can_message(p_conversation) then raise exception 'Conversation unavailable'; end if;
  select * into c from conversations where id = p_conversation and buyer_id = auth.uid();
  if not found then raise exception 'Only the buyer can make an offer'; end if;
  select * into l from listings where id = c.listing_id for update;
  if l.status <> 'active' or l.listing_type = 'giveaway' then raise exception 'Offers not possible'; end if;
  if p_amount is null or p_amount < 0 then raise exception 'Invalid amount'; end if;
  insert into offers(conversation_id,listing_id,buyer_id,amount_inr) values(c.id,c.listing_id,c.buyer_id,p_amount)
    returning id into oid;
  insert into messages(conversation_id,sender_id,body) values(c.id,auth.uid(),'Made an offer of ₹' || p_amount);
  return oid;
end $$;

create or replace function public.respond_offer(p_offer uuid,p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare o offers; c conversations; l listings;
begin
  select * into o from offers where id = p_offer;
  if not found then raise exception 'Offer not pending'; end if;
  if not public.can_message(o.conversation_id) then raise exception 'Conversation unavailable'; end if;
  select * into c from conversations where id = o.conversation_id and seller_id = auth.uid();
  if not found then raise exception 'Only the seller can respond'; end if;
  -- Every offer mutation locks the listing first, then rechecks offer state.
  select * into l from listings where id = o.listing_id for update;
  select * into o from offers where id = p_offer for update;
  if o.status <> 'pending' then raise exception 'Offer not pending'; end if;
  if p_accept is null then raise exception 'Response required'; end if;
  if p_accept and l.status <> 'active' then raise exception 'Listing unavailable'; end if;
  update offers set status = case when p_accept then 'accepted' else 'declined' end where id = p_offer;
  if p_accept then
    update listings set status='reserved',price_inr=o.amount_inr where id=o.listing_id;
    update offers set status='declined' where listing_id=o.listing_id and status='pending' and id<>p_offer;
  end if;
  insert into messages(conversation_id,sender_id,body) values(o.conversation_id,auth.uid(),
    case when p_accept then 'Accepted the offer of ₹' else 'Declined the offer of ₹' end || o.amount_inr);
end $$;
