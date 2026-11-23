#!/usr/bin/env bash
# Mirror Supabase Storage buckets to the laptop. Deleted/overwritten files are kept 30 days.
set -euo pipefail
KEYS="$HOME/.config/smugglr-backup/s3"
[ -f "$KEYS" ] || { echo "$(date -Is) photos: no key file yet, skipped" >>"$HOME/smugglr-backups/backup.log"; exit 0; }
# shellcheck disable=SC1090
. "$KEYS"   # defines S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY
ROOT="$HOME/smugglr-photos"; LOG="$HOME/smugglr-backups/backup.log"; day=$(date +%F)
export RCLONE_S3_PROVIDER=Other RCLONE_S3_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" RCLONE_S3_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" \
  RCLONE_S3_ENDPOINT="https://mkepigiktixxrowsteje.storage.supabase.co/storage/v1/s3" RCLONE_S3_REGION=ap-south-1 RCLONE_S3_NO_CHECK_BUCKET=true
mkdir -p "$ROOT/current" "$ROOT/deleted"
{
  for b in listing-photos chat-attachments; do
    rclone sync ":s3:$b" "$ROOT/current/$b" --backup-dir "$ROOT/deleted/$day/$b" --retries 3
  done
  find "$ROOT/deleted" -mindepth 1 -maxdepth 1 -type d -mtime +30 -exec rm -rf {} +
  echo "$(date -Is) photos ok $(find "$ROOT/current" -type f | wc -l) files $(du -sh "$ROOT/current" | cut -f1)"
} >>"$LOG" 2>&1 || { echo "$(date -Is) photos FAILED" >>"$LOG"; exit 1; }
