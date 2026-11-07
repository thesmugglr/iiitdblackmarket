-- Fix replies being refused. In 0011 the reply check said `r.id = reply_to_id`, and inside that subquery the bare
-- name resolved to r.reply_to_id (the quoted message's own column), not the new message's. Qualify it.
drop policy msg_insert on public.messages;
create policy msg_insert on public.messages for insert
  with check (sender_id = auth.uid() and public.can_message(conversation_id)
    and (messages.shared_listing_id is null or exists (select 1 from listings l
      where l.id = messages.shared_listing_id and (l.status <> 'removed' or l.seller_id = auth.uid())))
    and (messages.reply_to_id is null or exists (select 1 from messages r
      where r.id = messages.reply_to_id and r.conversation_id = messages.conversation_id)));
