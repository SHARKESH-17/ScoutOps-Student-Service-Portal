#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

if [[ -z "${SCOUTOPS_IMAGE_REPOSITORY:-}" ]]; then
  echo "Set SCOUTOPS_IMAGE_REPOSITORY in the environment or .env." >&2
  exit 1
fi
if [[ -z "${TLS_HOSTNAME:-}" ]]; then
  echo "Set TLS_HOSTNAME in the environment or .env." >&2
  exit 1
fi
COMPOSE=(docker compose -f docker-compose.prod.yml)
container_id="$(docker ps -q --filter label=com.docker.compose.service=scoutops-app | head -n 1)"
if [[ -z "$container_id" ]]; then
  echo "No running ScoutOps application container was found." >&2
  exit 1
fi
current_image="$(docker inspect --format '{{.Config.Image}}' "$container_id")"
CURRENT_TAG="${current_image##*:}"

PREVIOUS_TAG_FILE="${SCOUTOPS_PREVIOUS_TAG_FILE:-.scoutops-previous-tag}"
if [[ ! -s "$PREVIOUS_TAG_FILE" ]]; then
  echo "No previous deployed image tag is recorded in $PREVIOUS_TAG_FILE." >&2
  exit 1
fi

PREVIOUS_TAG="$(<"$PREVIOUS_TAG_FILE")"
if [[ "$PREVIOUS_TAG" == "$CURRENT_TAG" ]]; then
  echo "The recorded previous image tag matches the current tag; refusing a no-op rollback." >&2
  exit 1
fi

echo "Rolling back from $CURRENT_TAG to $PREVIOUS_TAG..."
SCOUTOPS_IMAGE_TAG="$PREVIOUS_TAG" "${COMPOSE[@]}" pull scoutops-app
SCOUTOPS_IMAGE_TAG="$PREVIOUS_TAG" "${COMPOSE[@]}" up -d --no-deps scoutops-app

for attempt in $(seq 1 30); do
  if curl --resolve "$TLS_HOSTNAME:443:127.0.0.1" --fail --silent "https://$TLS_HOSTNAME/health" >/dev/null; then
    printf '%s\n' "$CURRENT_TAG" > "$PREVIOUS_TAG_FILE"
    echo "Rollback to $PREVIOUS_TAG verified successfully."
    exit 0
  fi
  sleep 2
done

echo "Rollback did not become healthy; restoring $CURRENT_TAG." >&2
SCOUTOPS_IMAGE_TAG="$CURRENT_TAG" "${COMPOSE[@]}" up -d --no-deps scoutops-app
exit 1
