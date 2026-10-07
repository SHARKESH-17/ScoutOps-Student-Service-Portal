#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

required=(DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "$name must be configured in the environment or .env." >&2
    exit 1
  fi
done

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
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" < backups/scoutops-YYYYMMDD-HHMMSS.sql
EOF
