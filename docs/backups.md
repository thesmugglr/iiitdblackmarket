# Nightly backups on the spare laptop

Written 2026-11-07. The Supabase Free plan has no backups you can download, so the owner's spare Linux laptop (`ovoabhik` on Tailscale) keeps its own copies. Everything here is free.

## What gets backed up

| What | How | Kept |
| --- | --- | --- |
| Database: accounts (`auth`), listings, chats, offers, notifications, lost & found (`public`), file records (`storage`) | `pg_dump` custom format through the Supabase session pooler | The last 30 nightly files |
| Photos: buckets `listing-photos` and `chat-attachments` | `rclone sync` over Supabase's S3-compatible storage API: only new or changed files are downloaded | A current mirror; files deleted on the site are moved aside and kept 30 days |

Layout on the laptop: `~/iiitd-backups/db/` (dumps), `~/iiitd-backups/files/` (mirror), `~/iiitd-backups/deleted/<date>/` (removed files), `~/iiitd-backups/backup.log`. The script is `~/iiitd-backups/backup.sh`; it runs from cron at 03:00 and again shortly after boot if the laptop was off.

## Secrets (never in this repo, a chat or a log)

`~/.config/iiitd-backup/env`, mode 600, filled in by the owner:

```
PGURI='postgresql://postgres.mkepigiktixxrowsteje:<DB PASSWORD>@<pooler host>:5432/postgres'
S3_ACCESS_KEY_ID='<key id>'
S3_SECRET_ACCESS_KEY='<secret>'
S3_ENDPOINT='https://mkepigiktixxrowsteje.supabase.co/storage/v1/s3'
S3_REGION='ap-south-1'
```

Where they come from (Supabase dashboard, project `mkepigiktixxrowsteje`):

- `PGURI`: **Connect** (top bar) → **Session pooler** → copy the URI and put the database password in place of `[YOUR-PASSWORD]`. If the password is unknown, reset it in **Project Settings → Database**; the site does not use it, so nothing breaks.
- S3 keys: **Storage → S3 Configuration** (or Settings) → **New access key**. The secret is shown once. These keys can read and write every file, so they stay only on the laptop.

## Restoring

- Database: `pg_restore --list <file>.dump` shows the contents. Restore into a fresh project with `pg_restore --no-owner --no-privileges -d "$NEW_PGURI" <file>.dump`; expect harmless warnings for Supabase-managed objects.
- Photos: `rclone copy ~/iiitd-backups/files/<bucket> supa:<bucket>` with the new project's keys.

## Setting it up with Codex on the laptop

Paste this into Codex running on the spare laptop:

```
Set up nightly backups of my Supabase project on this Linux laptop. Do not print, log or commit any secret.

1. Install a PostgreSQL client that is version 17 or newer (use the official PGDG apt repository if the distro's is older; check `pg_dump --version`) and rclone (`sudo apt install rclone` or the official install script). If sudo needs a password, stop and tell me the exact commands to run myself.
2. Create ~/iiitd-backups/{db,files,deleted} (chmod 700) and ~/.config/iiitd-backup/env (chmod 600) containing these lines with empty values for me to fill in:
   PGURI=''
   S3_ACCESS_KEY_ID=''
   S3_SECRET_ACCESS_KEY=''
   S3_ENDPOINT='https://mkepigiktixxrowsteje.supabase.co/storage/v1/s3'
   S3_REGION='ap-south-1'
3. Write ~/iiitd-backups/backup.sh (bash, `set -euo pipefail`, chmod 700) that:
   - loads the env file, exits with a clear message if any value is empty, and uses a lock (flock) so two runs never overlap;
   - runs `pg_dump "$PGURI" -Fc --no-owner --no-privileges -n public -n auth -n storage -f ~/iiitd-backups/db/iiitd-$(date +%F-%H%M).dump.part`, renames it to .dump only on success, then checks it with `pg_restore --list` and deletes .dump files beyond the newest 30;
   - syncs the buckets listing-photos and chat-attachments with rclone into ~/iiitd-backups/files/<bucket>, configuring the S3 remote through RCLONE_CONFIG_SUPA_* environment variables (type s3, provider Other, endpoint/region/keys from the env file, force_path_style true) so no rclone config file holds the keys; pass --backup-dir ~/iiitd-backups/deleted/$(date +%F) so removed files are kept, and delete folders under deleted/ older than 30 days;
   - appends one line per run to ~/iiitd-backups/backup.log: time, OK or FAILED, dump size, number of files mirrored. Never write the env values to the log.
4. Add a crontab entry for my user: `0 3 * * *` and `@reboot sleep 300 &&` both running the script (it must skip the @reboot run if a dump from the last 20 hours exists).
5. Tell me to fill in the env file (do not ask me to paste secrets into this chat), then run the script once, show me the log line, `pg_restore --list` table count for public, and the file counts per bucket.
6. Tell me if the laptop is set to sleep on lid close or idle, because the 03:00 run needs it awake.
```

## Status

Set-up prompt written 2026-11-07. Not yet installed or run on the laptop; update this section with the first successful log line.
