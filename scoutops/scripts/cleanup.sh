#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Removing stopped containers..."
docker container prune -f

echo "Removing unused networks..."
docker network prune -f

echo "Removing unused Docker resources..."
docker system prune -f

if [[ "${1:-}" == "--delete-volumes" ]]; then
  read -r -p "This will delete production PostgreSQL volumes. Continue? [y/N] " response
  case "$response" in
    [yY]|[yY][eE][sS])
      echo "Deleting unused volumes..."
      docker volume prune -f
      ;;
    *)
      echo "Skipping volume deletion."
      ;;
  esac
fi

echo "Temporary files cleanup complete."
