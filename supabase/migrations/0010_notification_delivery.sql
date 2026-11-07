-- Repair grouped notifications without granting new access to user data.
-- An unread bell row can be reused, but each new event must refresh it.
alter table public.notifications add column push_requested_at timestamptz;
create or replace function public.notify(p_user uuid, p_kind text, p_title text, p_link text) returns void
language plpgsql security definer set search_path = public as $$
declare nid uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || ':' || coalesce(p_link, '') || ':' || p_kind, 0));
  select id into nid from notifications
    where user_id=p_user and link is not distinct from p_link and kind=p_kind and read_at is null
    order by created_at desc, id desc limit 1 for update;
  if nid is null then
    insert into notifications(user_id,kind,title,link) values(p_user,p_kind,left(p_title,200),p_link);
  else
    update notifications set title=left(p_title,200), created_at=clock_timestamp() where id=nid;
  end if;
end $$;

-- Confirm only messages actually displayed, never messages arriving after the read.
create function public.mark_conversation_seen(p_conversation uuid, p_messages uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.in_conversation(p_conversation) then raise exception 'Conversation unavailable'; end if;
  if coalesce(cardinality(p_messages),0)>1000 then raise exception 'Too many messages'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':/inbox/' || p_conversation::text || ':message',0));
  update messages set read_at=now()
    where conversation_id=p_conversation and sender_id<>auth.uid() and read_at is null and id=any(p_messages);
  if not exists(select 1 from messages where conversation_id=p_conversation and sender_id<>auth.uid() and read_at is null) then
    update notifications set read_at=now() where user_id=auth.uid() and kind='message'
      and link='/inbox/' || p_conversation::text and read_at is null;
  end if;
end $$;
revoke all on function public.mark_conversation_seen(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.mark_conversation_seen(uuid,uuid[]) to authenticated;

-- Only confirm registration for the currently approved account and exact keys.
create function public.push_subscription_registered(p_endpoint text,p_p256dh text,p_auth text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_member() and exists(select 1 from push_subscriptions
    where user_id=auth.uid() and endpoint=p_endpoint and p256dh=p_p256dh and auth=p_auth)
$$;
revoke all on function public.push_subscription_registered(text,text,text) from public,anon,authenticated;
grant execute on function public.push_subscription_registered(text,text,text) to authenticated;

-- Refresh events deliver again, at most once per grouped destination per 15 seconds.
-- Throttling is leading-edge, not a promise to deliver every message in a burst.
create or replace function public.send_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare cfg push_config;
begin
  if tg_op='UPDATE' and old.push_requested_at > clock_timestamp()-interval '15 seconds' then return new; end if;
  select * into cfg from push_config where id;
  if cfg.function_url is null
    or not exists(select 1 from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='net' and p.proname='http_post')
    or not exists(select 1 from push_subscriptions where user_id=new.user_id)
    or not exists(select 1 from profiles where id=new.user_id and status='approved') then return new; end if;
  begin
    perform net.http_post(url:=cfg.function_url,body:=jsonb_build_object('notification_id',new.id),
      headers:=jsonb_build_object('Content-Type','application/json','x-push-secret',cfg.secret),timeout_milliseconds:=8000);
    new.push_requested_at:=clock_timestamp();
  exception when others then
    null; -- Optional delivery cannot roll back the marketplace write.
  end;
  return new;
end $$;
drop trigger notifications_push on public.notifications;
create trigger notifications_push before insert or update of created_at on public.notifications
for each row execute function public.send_push();
