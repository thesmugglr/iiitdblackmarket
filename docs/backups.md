# Nightly backups on the spare Linux laptop

The Smugglr uses a private backup of its Postgres data and both private photo buckets. Abhik operates the spare laptop. Each completed snapshot contains the `auth`, `public` and `storage` schemas and copies of `listing-photos` and `chat-attachments`. Database and object storage are copied in sequence. Concurrent changes may need reconciliation during recovery.

## Install

Use an encrypted volume large enough for one current photo mirror, 30 database dumps and 30 snapshots of changed photos. Install a PostgreSQL client compatible with the hosted server (17 or newer), rclone, rsync, flock and cron. From the reviewed checkout run:

```bash
install -d -m 700 ~/iiitd-backups ~/.config/iiitd-backup
install -m 700 scripts/backup.sh ~/iiitd-backups/backup.sh
(umask 077; touch ~/.config/iiitd-backup/env)
chmod 600 ~/.config/iiitd-backup/env
```

In that file, enter shell-quoted values for `PGHOST`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` and `PGPORT` from the Supabase **session pooler** settings. Set `PGSSLROOTCERT` to the path of the trusted CA certificate for the pooler. The runner verifies the certificate and hostname. Also enter `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` from Storage settings. Keep the file on the laptop and restrict access to the owner.

Run `~/iiitd-backups/backup.sh` once. Verify the OK entry in `~/iiitd-backups/backup.log`, list the database archive with `pg_restore --list`, and check both bucket directories in the completed snapshot. Configure these entries with `crontab -e` on the laptop:

```cron
0 3 * * * "$HOME/iiitd-backups/backup.sh"
@reboot sleep 300 && "$HOME/iiitd-backups/backup.sh" --boot
```

The laptop must be awake at the scheduled time. A lock prevents overlapping runs. Snapshots appear under `~/iiitd-backups/snapshots/` only after the dump can be decoded and both bucket copies finish. Unchanged photos share disk blocks with the previous snapshot. Treat completed snapshots as read-only. Retention keeps the last 30 successful snapshots.

## Restore drill

Use an isolated disposable Supabase stack with compatible Auth and Storage versions. Disable email delivery, push and other outbound hooks. Use only destination credentials for restore operations. Restore the archive into the disposable database using the Supabase restore procedure for that stack. Inspect every restore error, including conflicts with platform-managed tables. For a Storage API restore, import the object bytes using the destination API and reconcile its metadata with the archive. Restoring metadata alone does not restore photo bytes.

Check row counts and bucket object counts against the selected snapshot. Open a restored listing and photo with an authorized test account, then verify an unrelated test account cannot read a private chat or its attachments. Record the date, counts, elapsed time and any reconciliation required. Keep credentials, account details, filenames and message contents out of the record.

## Status

Runner prepared. The first completed backup and successful restore drill on the owner's laptop still need confirmation.
