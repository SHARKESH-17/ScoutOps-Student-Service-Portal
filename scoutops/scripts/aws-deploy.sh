#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -z "${AWS_REGION:-}" ]]; then
  echo "AWS_REGION is required. Export it or set it in .env." >&2
  exit 1
fi

if [[ -z "${AWS_EC2_HOST:-}" ]]; then
  echo "AWS_EC2_HOST is required. Export it or set it in .env." >&2
  exit 1
fi

if [[ -z "${AWS_DEPLOY_USER:-}" ]]; then
  echo "AWS_DEPLOY_USER is required. Export it or set it in .env." >&2
  exit 1
fi

if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

echo "[1/4] Building ScoutOps production image..."
docker compose -f docker-compose.prod.yml build

echo "[2/4] Starting production stack..."
docker compose -f docker-compose.prod.yml up -d

echo "[3/4] Waiting for application health..."
for i in $(seq 1 30); do
  if curl -fsS http://localhost:3000/health >/dev/null 2>&1; then
    echo "Health check passed."
    break
  fi
  sleep 2
  if [[ $i -eq 30 ]]; then
    echo "Application health check failed on EC2 host." >&2
    exit 1
  fi
done

echo "[4/4] Deployment ready"
printf 'EC2 host: %s\n' "${AWS_EC2_HOST}"
printf 'AWS region: %s\n' "${AWS_REGION}"
printf 'HTTP URL: http://%s:3000\n' "${AWS_EC2_HOST}"
