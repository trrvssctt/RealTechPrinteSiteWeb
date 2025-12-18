#!/usr/bin/env bash
set -euo pipefail

# Simple backup script using pg_dump. Expects DATABASE_URL in environment.
# Usage: ./backup.sh /path/to/output/folder

OUTDIR=${1:-./backups}
mkdir -p "$OUTDIR"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set" >&2
  exit 2
fi

TS=$(date +%F_%H%M%S)
FILENAME="db_${TS}.dump"

echo "Backing up database to $OUTDIR/$FILENAME"
pg_dump --format=custom --file="$OUTDIR/$FILENAME" "$DATABASE_URL"

echo "Compressing"
gzip -f "$OUTDIR/$FILENAME"

echo "Backup complete: $OUTDIR/${FILENAME}.gz"

# Optional: upload to S3 if env vars are configured (awscli must be installed and configured)
if [ -n "${S3_BUCKET:-}" ]; then
  if command -v aws >/dev/null 2>&1; then
    echo "Uploading to s3://$S3_BUCKET/"
    aws s3 cp "$OUTDIR/${FILENAME}.gz" "s3://$S3_BUCKET/" --acl private
  else
    echo "aws CLI not installed; skipping S3 upload"
  fi
fi
