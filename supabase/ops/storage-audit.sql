-- Operational report, NOT a migration or an API function. Run through a
-- trusted SQL administrator. Keep results private: samples contain object paths.
-- No file or metadata deletion is performed. Age is triage, not deletion proof.
begin transaction isolation level repeatable read read only;
set local statement_timeout = '15s';
set local lock_timeout = '1s';

do $audit$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = current_user and (rolsuper or rolbypassrls)) then
    raise exception 'Storage audit requires a trusted SQL administrator with full catalog access';
  end if;
  if coalesce(nullif(current_setting('iiitd.audit_min_age', true), ''), '24 hours')::interval < interval '0 seconds' then
    raise exception 'Storage audit minimum age must be nonnegative';
  end if;
end
$audit$;

with
params as (
  -- Optional session setting: SET iiitd.audit_min_age = '48 hours';
  select coalesce(nullif(current_setting('iiitd.audit_min_age', true), ''), '24 hours')::interval as min_age,
    100::integer as sample_limit
),
scope(bucket_id) as (values ('listing-photos'::text), ('chat-attachments'::text)),
listing_paths as (
  -- Deliberately preserve ALL statuses/expiry dates: an expired listing can be
  -- renewed and a removed listing can remain relevant to moderation/history.
  select photo.path from public.listings l
  cross join lateral unnest(l.photos) as photo(path)
),
raw_refs(bucket_id, name, required, origin) as (
  select 'listing-photos', path, true, 'listing_original' from listing_paths
  union all
  select 'listing-photos', regexp_replace(path, '\.[^./]+$', '') || '_t.jpg', false, 'listing_thumbnail'
    from listing_paths where path is not null and path <> ''
  union all
  select 'chat-attachments', image_path, true, 'chat_attachment'
    from public.messages where image_path is not null
),
refs as (
  select bucket_id, name, bool_or(required) as required, count(*) as reference_count,
    array_agg(distinct origin order by origin) as origins
  from raw_refs where name is not null and name <> '' group by bucket_id, name
),
objects as (
  select o.bucket_id, o.name, greatest(o.created_at, o.updated_at) as last_modified_at,
    case when o.metadata->>'size' ~ '^[0-9]{1,30}$' then (o.metadata->>'size')::numeric else null end as known_bytes
  from storage.objects o join scope s using (bucket_id)
),
inventory as (
  select o.*, coalesce(r.reference_count, 0) as reference_count,
    case when r.name is not null then 'referenced'
      when o.last_modified_at is null or o.last_modified_at > now() - p.min_age then 'held_unreferenced'
      else 'review_candidate' end as classification
  from objects o cross join params p left join refs r using (bucket_id, name)
),
missing_refs as (
  select r.* from refs r left join objects o using (bucket_id, name) where o.name is null
),
bucket_reports as (
  select s.bucket_id, jsonb_build_object(
    'bucket_id', s.bucket_id, 'bucket_exists', b.id is not null, 'public', b.public,
    'file_size_limit_bytes', b.file_size_limit::text, 'allowed_mime_types', b.allowed_mime_types,
    'objects', (select count(*) from inventory i where i.bucket_id = s.bucket_id),
    'known_object_bytes', (select coalesce(sum(i.known_bytes), 0)::text from inventory i where i.bucket_id = s.bucket_id),
    'unknown_size_objects', (select count(*) from inventory i where i.bucket_id = s.bucket_id and i.known_bytes is null),
    'referenced_objects', (select count(*) from inventory i where i.bucket_id = s.bucket_id and i.classification = 'referenced'),
    'held_unreferenced_objects', (select count(*) from inventory i where i.bucket_id = s.bucket_id and i.classification = 'held_unreferenced'),
    'review_candidate_objects', (select count(*) from inventory i where i.bucket_id = s.bucket_id and i.classification = 'review_candidate'),
    'review_candidate_known_bytes', (select coalesce(sum(i.known_bytes), 0)::text from inventory i where i.bucket_id = s.bucket_id and i.classification = 'review_candidate'),
    'missing_required_metadata', (select count(*) from missing_refs r where r.bucket_id = s.bucket_id and r.required),
    'missing_optional_thumbnail_metadata', (select count(*) from missing_refs r where r.bucket_id = s.bucket_id and not r.required)
  ) as report
  from scope s left join storage.buckets b on b.id = s.bucket_id
)
select jsonb_build_object(
  'audit_version', 1, 'snapshot_at', now(),
  'transaction_read_only', current_setting('transaction_read_only'),
  'transaction_isolation', current_setting('transaction_isolation'),
  'database_bytes', pg_database_size(current_database())::text,
  'minimum_age_seconds', (select extract(epoch from min_age) from params),
  'sample_limit', (select sample_limit from params),
  'buckets', (select jsonb_agg(report order by bucket_id) from bucket_reports),
  'invalid_reference_entries', (select count(*) from raw_refs where name is null or name = ''),
  'review_candidate_sample_truncated', (select count(*) from inventory where classification = 'review_candidate') > (select sample_limit from params),
  'review_candidate_sample', coalesce((
    select jsonb_agg(jsonb_build_object('bucket_id', x.bucket_id, 'name', x.name,
      'last_modified_at', x.last_modified_at, 'known_bytes', x.known_bytes::text)
      order by x.last_modified_at, x.bucket_id, x.name)
    from (select * from inventory where classification = 'review_candidate'
      order by last_modified_at, bucket_id, name limit (select sample_limit from params)) x
  ), '[]'::jsonb),
  'missing_reference_sample_truncated', (select count(*) from missing_refs) > (select sample_limit from params),
  'missing_reference_sample', coalesce((
    select jsonb_agg(jsonb_build_object('bucket_id', x.bucket_id, 'name', x.name,
      'required', x.required, 'reference_count', x.reference_count, 'origins', x.origins)
      order by x.required desc, x.bucket_id, x.name)
    from (select * from missing_refs order by required desc, bucket_id, name limit (select sample_limit from params)) x
  ), '[]'::jsonb)
) as storage_audit;

commit;
