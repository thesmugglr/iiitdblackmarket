-- New RPCs for retryable clients. Keep legacy make_offer/respond_offer intact
-- so an already deployed client remains compatible during the rollout.
create or replace function public.make_offer_once(p_conversation uuid, p_amount integer, p_request uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare c conversations; l listings; o offers;
begin
  if not public.can_message(p_conversation) then raise exception 'Conversation unavailable'; end if;
  select * into c from conversations where id = p_conversation and buyer_id = auth.uid();
  if not found then raise exception 'Only the buyer can make an offer'; end if;
  if p_request is null or p_amount is null or p_amount < 0 then raise exception 'Invalid offer request'; end if;
  -- Use the same listing-first lock order as existing offer decisions.
  select * into l from listings where id = c.listing_id for update;
  if not found then raise exception 'Listing unavailable'; end if;
  select * into o from offers where id = p_request;
  if found then
    if o.conversation_id <> c.id or o.buyer_id <> auth.uid() or o.listing_id <> l.id or o.amount_inr <> p_amount then
      raise exception 'Offer request does not match';
    end if;
    -- Confirm a prior commit without creating another offer/message, including
    -- when the seller has already responded or the listing later expired.
    return o.id;
  end if;
  if l.status <> 'active' or l.expires_at <= now() or l.listing_type = 'giveaway' then raise exception 'Offers not possible'; end if;
  insert into offers(id,conversation_id,listing_id,buyer_id,amount_inr)
    values(p_request,c.id,c.listing_id,c.buyer_id,p_amount);
  insert into messages(conversation_id,sender_id,body)
    values(c.id,auth.uid(),'Made an offer of ₹' || p_amount);
  return p_request;
end $$;

create or replace function public.respond_offer_once(p_offer uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare o offers; c conversations; expected text;
begin
  if p_accept is null then raise exception 'Response required'; end if;
  select * into o from offers where id = p_offer;
  if not found then raise exception 'Offer unavailable'; end if;
  if not public.can_message(o.conversation_id) then raise exception 'Conversation unavailable'; end if;
  select * into c from conversations where id = o.conversation_id and seller_id = auth.uid();
  if not found then raise exception 'Only the seller can respond'; end if;
  perform 1 from listings where id = o.listing_id for update;
  select * into o from offers where id = p_offer for update;
  if not found then raise exception 'Offer unavailable'; end if;
  expected := case when p_accept then 'accepted' else 'declined' end;
  if o.status = expected then return; end if;
  if o.status <> 'pending' then raise exception 'Offer already has a different response'; end if;
  -- Reuse the existing expiry, reservation and competing-offer checks. These
  -- reentrant locks retain listing-first order and one response message.
  perform public.respond_offer(p_offer, p_accept);
end $$;

revoke all on function public.make_offer_once(uuid,integer,uuid) from public,anon,authenticated;
revoke all on function public.respond_offer_once(uuid,boolean) from public,anon,authenticated;
grant execute on function public.make_offer_once(uuid,integer,uuid) to authenticated;
grant execute on function public.respond_offer_once(uuid,boolean) to authenticated;
