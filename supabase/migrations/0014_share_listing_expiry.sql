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
  -- A shared card can disclose the title to another member. Only share unexpired listings.
  select * into l from listings where id = p_listing and status in ('active','reserved','sold') and expires_at > now();
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
