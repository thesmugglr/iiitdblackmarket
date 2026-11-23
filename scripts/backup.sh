#!/usr/bin/env bash
# Run on the owner's backup laptop. Write only below the current user's backup directory.
set -euo pipefail
umask 077
root="$HOME/iiitd-backups"
config="$HOME/.config/iiitd-backup/env"
mkdir -p "$root"
chmod 700 "$root"
exec 9>"$root/.lock"
flock -n 9 || exit 0

stamp=$(date +%F-%H%M%S)
stage=''
finish() {
  rc=$?
  if [[ -n "$stage" ]]; then rm -rf -- "$stage"; fi
  if (( rc != 0 )); then printf '%s FAILED\n' "$stamp" >> "$root/backup.log"; fi
}
trap finish EXIT
if [[ ! -f "$config" || ! -O "$config" || $(stat -c %a "$config") != 600 ]]; then
  echo "A user-owned mode 600 backup configuration is required." >&2
  exit 1
fi
# This owner-managed shell file contains private values. Keep them out of arguments and logs.
source "$config"
: "${PGHOST:?missing PGHOST}" "${PGUSER:?missing PGUSER}" "${PGPASSWORD:?missing PGPASSWORD}"
: "${S3_ENDPOINT:?missing S3_ENDPOINT}" "${S3_REGION:?missing S3_REGION}"
: "${S3_ACCESS_KEY_ID:?missing S3_ACCESS_KEY_ID}" "${S3_SECRET_ACCESS_KEY:?missing S3_SECRET_ACCESS_KEY}"
export PGSSLROOTCERT
export PGHOST PGUSER PGPASSWORD PGDATABASE="${PGDATABASE:-postgres}" PGPORT="${PGPORT:-5432}" PGSSLMODE=verify-full
export RCLONE_CONFIG_SUPA_TYPE=s3 RCLONE_CONFIG_SUPA_PROVIDER=Other RCLONE_CONFIG_SUPA_FORCE_PATH_STYLE=true
export RCLONE_CONFIG_SUPA_ENDPOINT="$S3_ENDPOINT" RCLONE_CONFIG_SUPA_REGION="$S3_REGION"
export RCLONE_CONFIG_SUPA_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" RCLONE_CONFIG_SUPA_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY"
mkdir -p "$root/snapshots" "$root/mirror"
cd "$root/snapshots"
shopt -s nullglob
pattern='[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]-[0-9][0-9][0-9][0-9][0-9][0-9]'
snapshots=( $pattern )
latest=''
if (( ${#snapshots[@]} )); then
  latest="$PWD/${snapshots[-1]}"
  if [[ ${snapshots[-1]:0:10} == "${stamp:0:10}" ]]; then exit 0; fi
  if [[ ${1:-} == --boot ]] && [[ -n $(find "$latest" -maxdepth 0 -mmin -1200 -print) ]]; then exit 0; fi
fi

stage=$(mktemp -d "$PWD/.partial.XXXXXXXX")
pg_dump -Fc --no-owner --no-privileges -n public -n auth -n storage -f "$stage/database.dump"
pg_restore --file=/dev/null "$stage/database.dump"
for bucket in listing-photos chat-attachments; do
  mirror="$root/mirror/$bucket"
  mkdir -p "$mirror" "$stage/$bucket"
  rclone sync "supa:$bucket" "$mirror" --config /dev/null --log-level ERROR
  link=()
  if [[ -n "$latest" ]]; then link=(--link-dest="$latest/$bucket"); fi
  rsync -a --checksum "${link[@]}" "$mirror/" "$stage/$bucket/"
done
mv -T -- "$stage" "$stamp"
stage=''
printf '%s OK\n' "$stamp" >> "$root/backup.log"
snapshots=( $pattern )
for ((i=0; i<${#snapshots[@]}-30; i++)); do rm -rf -- "${snapshots[i]}"; done
