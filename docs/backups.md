# Nightly backups

The Supabase Free plan has no backups you can download, so a spare Linux machine keeps its own copies. Everything here is free. Written 2026-11-07, rewritten 2026-11-23 after the backup went live.

## What gets backed up

| What | How | Kept |
| --- | --- | --- |
| Database: accounts (`auth`), listings, chats, offers, notifications, lost & found, visit counts (`public`), file records (`storage`) | `pg_dump` (custom format, PostgreSQL 17 client) through the Supabase session pooler, checked with `pg_restore --list` | The newest 30 nightly files |
| Photos: buckets `listing-photos` and `chat-attachments` | `rclone sync` over Supabase's S3-compatible storage API; only new or changed files are downloaded | A current mirror; files deleted on the site are kept 30 days in a dated folder |

The scripts are in [`ops/backup/`](../ops/backup): `backup.sh` (database, then calls `photos.sh`) and `photos.sh`. Cron runs `backup.sh` at 03:00 and again 3 minutes after boot; the script skips if today's dump already exists.

## One-time setup

1. **Client tools.** Install `postgresql-client-17` (from the official PGDG apt repository if the distribution's is older; the database is PostgreSQL 17) and `rclone`.
2. **Read-only database role** (run once as the project owner; pick a long random password and keep it only on the backup machine):

   ```sql
   create role backup_reader login bypassrls password '<long random password>';
   grant pg_read_all_data to backup_reader;
   alter role backup_reader set statement_timeout = '10min';
   ```

   The role cannot write and is not a superuser. `bypassrls` is needed so row-level security does not hide rows from the dump.
3. **Secrets, on the backup machine only** (directory `~/.config/smugglr-backup/`, mode 700, files mode 600, never in this repo, a chat or a log):
   - `pw`: the `backup_reader` password.
   - `s3`: two lines, `S3_ACCESS_KEY_ID=...` and `S3_SECRET_ACCESS_KEY=...`, from Supabase **Storage → S3 Configuration → New access key** (the secret is shown once; these keys can read and write every file).
4. **Scripts and schedule.** Copy `ops/backup/*.sh` to `~/smugglr-backup/`, make them executable, and add to the crontab:

   ```
   0 3 * * * $HOME/smugglr-backup/backup.sh
   @reboot sleep 180 && $HOME/smugglr-backup/backup.sh
   ```

   Make sure the machine does not sleep with the lid closed (`HandleLidSwitch=ignore` in `/etc/systemd/logind.conf`).
5. **First run:** `FORCE=1 ~/smugglr-backup/backup.sh`, then check `~/smugglr-backups/backup.log`.

The IPv6-only direct database host is not reachable from many home networks, which is why the scripts use the session pooler (`aws-0-ap-south-1.pooler.supabase.com`, user `backup_reader.<project ref>`).

## Restoring

- Database: `pg_restore --list <file>.dump` shows the contents. Restore into a fresh project with `pg_restore --no-owner --no-privileges -d "$NEW_PGURI" <file>.dump`; expect harmless warnings for Supabase-managed objects.
- Photos: `rclone copy ~/smugglr-photos/current/<bucket> supa:<bucket>` with the new project's keys.

## Status

Live since 2026-11-23: database dump and photo mirror both ran successfully (38 photos, 2.7 MB). Not done yet: a copy of the backups outside the backup machine, and a practice restore into a scratch project.
