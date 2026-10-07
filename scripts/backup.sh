#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

: "${DB_HOST:=postgres}"
: "${DB_PORT:=5432}"
: "${DB_NAME:=scoutops}"
: "${DB_USER:=scoutops_user}"
: "${DB_PASSWORD:=change_me}"

BACKUP_DIR="$ROOT_DIR/backups"
mkdir -p "$BACKUP_DIR"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/scoutops-${TIMESTAMP}.sql"

export PGPASSWORD="$DB_PASSWORD"

pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --clean --if-exists \
  > "$BACKUP_FILE"

printf 'Backup created: %s\n' "$BACKUP_FILE"

cat <<'EOF'
Restore example:
  PGPASSWORD="change_me" psql -h localhost -p 5432 -U scoutops_user -d scoutops < backups/scoutops-YYYYMMDD-HHMMSS.sql
EOF
