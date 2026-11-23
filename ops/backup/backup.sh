#!/usr/bin/env bash
# Nightly Supabase database backup for The Smugglr. Read-only role, 30 dumps kept.
set -euo pipefail
REF=mkepigiktixxrowsteje
DIR="$HOME/smugglr-backups"; LOG="$DIR/backup.log"; KEEP=30
PGBIN=/usr/lib/postgresql/17/bin
export PGPASSWORD="$(cat "$HOME/.config/smugglr-backup/pw")"
mkdir -p "$DIR"
today=$(date +%F)
if [ "${FORCE:-0}" != 1 ] && ls "$DIR"/smugglr-"$today"-*.dump >/dev/null 2>&1; then exit 0; fi
out="$DIR/smugglr-$today-$(date +%H%M).dump"
{
  echo "$(date -Is) start"
  "$PGBIN/pg_dump" "host=aws-0-ap-south-1.pooler.supabase.com port=5432 dbname=postgres user=backup_reader.$REF sslmode=require" \
    -Fc --no-owner --no-privileges -f "$out.tmp"
  "$PGBIN/pg_restore" --list "$out.tmp" >/dev/null
  mv "$out.tmp" "$out"
  echo "$(date -Is) ok $(du -h "$out" | cut -f1) $out"
  ls -1t "$DIR"/smugglr-*.dump | tail -n +$((KEEP+1)) | xargs -r rm -f
} >>"$LOG" 2>&1 || { rm -f "$out.tmp"; echo "$(date -Is) FAILED" >>"$LOG"; exit 1; }
"$HOME/smugglr-backup/photos.sh" || true
