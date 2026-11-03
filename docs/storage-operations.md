# Storage inventory and reference review

Owner: Garv Rao / Codex. OPS-01 supplies a manual, read-only report at [supabase/ops/storage-audit.sql](../supabase/ops/storage-audit.sql). It is not a migration, public RPC, scheduled monitor or cleanup job. No hosted report or deletion has been performed by this work.

## Run the report

Use the selected project's trusted SQL administrator session, such as the Supabase dashboard SQL Editor. Verify the project first: the selected hosted project is `mkepigiktixxrowsteje`; local CI uses a separate disposable stack. Run the entire SQL file as one standalone batch, outside another transaction. The script requires a superuser or BYPASSRLS role so application policies cannot silently hide references. Marketplace admin access alone is insufficient. Do not grant additional privileges to an application role to run it.

The script starts a read-only, repeatable-read transaction with a 15-second statement timeout and one-second lock timeout. It changes no rows, policies, schema, bucket configuration or files. On failure, issue `ROLLBACK` in the same session before retrying. Keep the JSON result private: samples include storage paths and conversation identifiers. Do not commit it, paste it into a public issue, or share credentials.

Default triage age is 24 hours. To use a longer hold, put this before the full script in the same SQL batch:

```sql
set iiitd.audit_min_age = '48 hours';
-- Paste the entire storage-audit.sql file here.
```

The setting is session-scoped; reconnect or `RESET iiitd.audit_min_age` to restore the default. Negative intervals are rejected. Zero is supported for disposable tests and does not establish a safe production retention period.

## Interpret the result

| Field | Meaning |
| --- | --- |
| `snapshot_at`, `transaction_read_only`, `transaction_isolation` | Database snapshot time and execution mode. Expect `on` and `repeatable read`. |
| `buckets` | Only `listing-photos` and `chat-attachments`, including missing-bucket flags, privacy, size and MIME restrictions. Missing or public buckets require investigation; this report does not fix them. |
| `objects`, `known_object_bytes`, `unknown_size_objects` | Metadata row count, sum of valid nonnegative integer size metadata, and files whose metadata size is absent or malformed. Byte values are decimal strings to preserve large integers. Unknown sizes are not zero. |
| `referenced_objects` | Existing metadata referenced by any listing photo, expected listing thumbnail or message attachment. References are deduplicated before summing sizes. |
| `held_unreferenced_objects` | Unlinked metadata with a recent creation/update time, or no known timestamp. This protects uploads awaiting linkage from being treated as old candidates. |
| `review_candidate_objects`, `review_candidate_known_bytes` | Unlinked metadata older than the hold, based on the later creation/update timestamp. These are investigation candidates, not deletion instructions. |
| `missing_required_metadata` | Listing originals or chat image references with no matching object metadata. This indicates a possible broken reference; the report never downloads content. |
| `missing_optional_thumbnail_metadata` | Expected thumbnail paths without metadata. Older photos may never have had thumbnails; the client can fall back to the original. |
| `invalid_reference_entries` | Null/empty listing-photo entries or empty chat image paths. Text-only messages with null image paths are valid and excluded. |
| `database_bytes` | PostgreSQL database size at the time of the query, including internal schemas. It is not stored image bytes, billable disk use, or a quota calculation. |

Candidate and missing-reference samples contain at most 100 entries each. Check their `*_sample_truncated` flags and the complete per-bucket counts; an omitted path in a truncated sample proves nothing. The report does not read message bodies, account emails or student rosters.

All listing references are preserved, including sold, removed and expired listings. Expired listings can be renewed; moderation/history may still need removed-listing photos. Thumbnails follow the client's `thumbPath` naming rule and count as references when present. Message attachments remain protected regardless of message age. No age-based listing or message retention policy is introduced.

## Review and usage follow-up

This is a database metadata snapshot. It cannot prove that bytes still exist in object storage, account for inaccessible underlying objects, measure egress, establish a backup, or replace organization billing/Usage figures. [Supabase's Storage schema guidance](https://supabase.com/docs/guides/storage/schema/design) permits metadata queries and requires file mutations through the Storage API; deleting SQL metadata can leave underlying objects behind. [Storage usage documentation](https://supabase.com/docs/guides/platform/manage-your-usage/storage-size) explains the Usage dashboard and billing-period measurement.

When project access is available, inspect the organization Usage page for the selected project and period: Storage size, database/disk, egress and plan/billing status. Keep dated totals and the period in a private operations record; only publish non-sensitive aggregate findings. Recheck against the current free-plan limits. This source change does not establish live usage, automatic alerts or a zero-cost guarantee.

Investigate missing originals before considering cleanup. For an unlinked candidate, check pending/uncertain writes, upload activity, moderation needs and retention/backup requirements. A later write may link it after this snapshot. Any future deletion needs a separate trusted workflow with a fresh reference check and concurrency/retention safeguards, using the Storage API. Never delete from `storage.objects` or `storage.buckets` directly. No cleanup command is supplied here.

## Verification

The regression suite executes the actual SQL with PostgreSQL/PGlite fixtures covering all listing statuses, chat references, duplicate refs, optional thumbnails, missing buckets, unknown/large sizes, bounded samples, age holds, ordinary-role rejection and read-only execution. The disposable Supabase suite also runs the exact SQL through local PostgreSQL using real Storage uploads, listing/message references and default/zero-age reports, then checks unchanged rows and downloadable bytes. Local CI contains no hosted connection and suppresses report output. [PR #33](https://github.com/garvrao80/iiitdblackmarket/pull/33) passed all 427 regressions, build/lint and both final-head GitHub checks on `87083c1`; all 41 service scenarios and fixture cleanup passed in run 41618351157. Docker was unavailable on the reviewer's Windows host. Hosted execution, actual usage, bandwidth monitoring and any cleanup remain pending.
