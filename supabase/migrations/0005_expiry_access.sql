-- Keep expiry enforced in privileged write paths, not only feed RLS.
create or replace function public.start_conversation(p_listing uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare l listings; cid uuid;
begin
  if not public.is_member() then raise exception 'Not an approved member'; end if;
  select * into l from listings where id = p_listing and status in ('active','reserved') and expires_at > now();
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
  if l.status <> 'active' or l.expires_at <= now() or l.listing_type = 'giveaway' then raise exception 'Offers not possible'; end if;
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
  if p_accept and (l.status <> 'active' or l.expires_at <= now()) then raise exception 'Listing unavailable'; end if;
  update offers set status = case when p_accept then 'accepted' else 'declined' end where id = p_offer;
  if p_accept then
    update listings set status='reserved',price_inr=o.amount_inr where id=o.listing_id;
    update offers set status='declined' where listing_id=o.listing_id and status='pending' and id<>p_offer;
  end if;
  insert into messages(conversation_id,sender_id,body) values(o.conversation_id,auth.uid(),
    case when p_accept then 'Accepted the offer of ₹' else 'Declined the offer of ₹' end || o.amount_inr);
end $$;

drop policy wresp_read on public.wanted_responses;
create policy wresp_read on public.wanted_responses for select
using (public.is_member() and (responder_id=auth.uid() or exists(select 1 from wanted_posts p where p.id=post_id and p.user_id=auth.uid())));
