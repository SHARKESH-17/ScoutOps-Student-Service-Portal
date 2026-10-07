#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

CURRENT_TAG="${SCOUTOPS_IMAGE_TAG:-latest}"
PREVIOUS_TAG="$(docker images scoutops --format '{{.Tag}}' | sort -V | tail -n 2 | head -n 1 || true)"

if [[ -z "$PREVIOUS_TAG" || "$PREVIOUS_TAG" == "$CURRENT_TAG" ]]; then
  echo "No previous ScoutOps image tag was found. Nothing to roll back."
  exit 1
fi

echo "Current tag: $CURRENT_TAG"
echo "Previous tag: $PREVIOUS_TAG"

echo "Stopping the current application..."
docker compose -f docker-compose.prod.yml stop scoutops-app

echo "Starting previous image tag: $PREVIOUS_TAG"
SCOUTOPS_IMAGE_TAG="$PREVIOUS_TAG" docker compose -f docker-compose.prod.yml up -d --no-deps --force-recreate scoutops-app

for i in $(seq 1 30); do
  if curl -fsS http://localhost:3000/health >/dev/null 2>&1; then
    echo "Rollback verified successfully."
    exit 0
  fi
  sleep 2
done

echo "Rollback did not verify healthy within 60 seconds." >&2
exit 1
