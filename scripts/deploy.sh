#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

if [[ -z "${DB_NAME:-}" ]]; then
  export DB_NAME="scoutops"
fi
if [[ -z "${DB_USER:-}" ]]; then
  export DB_USER="scoutops_user"
fi
if [[ -z "${DB_PASSWORD:-}" ]]; then
  export DB_PASSWORD="change_me"
fi

echo "[1/6] Validating environment..."
command -v docker >/dev/null 2>&1 || { echo "Docker is required but not installed."; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "curl is required but not installed."; exit 1; }

echo "[2/6] Building ScoutOps production image..."
docker compose -f docker-compose.prod.yml build --no-cache

echo "[3/6] Starting PostgreSQL and the application..."
docker compose -f docker-compose.prod.yml up -d

echo "[4/6] Waiting for application health..."
for i in $(seq 1 30); do
  if curl -fsS http://localhost:3000/health >/dev/null 2>&1; then
    echo "Application health verified."
    break
  fi
  sleep 2
  if [[ $i -eq 30 ]]; then
    echo "Application did not become healthy within 60 seconds." >&2
    docker compose -f docker-compose.prod.yml ps
    exit 1
  fi
done

echo "[5/6] Verifying database health..."
curl -fsS http://localhost:3000/health/db

echo "[6/6] Deployment complete."
printf '\nService URL: http://localhost:3000\n'
