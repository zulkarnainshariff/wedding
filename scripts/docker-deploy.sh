#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "Missing .env file. Copy .env.example to .env and fill in values." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL must be set in .env" >&2
  exit 1
fi

if [[ -z "${SESSION_SECRET:-}" ]]; then
  echo "SESSION_SECRET must be set in .env" >&2
  exit 1
fi

# migrate is behind the "tools" profile, so plain `docker compose build` only builds wedding.
echo "Building images..."
docker compose build wedding
docker compose --profile tools build migrate

echo "Stopping existing containers (release DB connections before migrate)..."
docker compose down --remove-orphans || true
# Remove orphaned recreate stubs left by interrupted deploys (e.g. <hash>_wedding-app).
if ids="$(docker ps -aq --filter "name=wedding-app" 2>/dev/null)"; then
  # shellcheck disable=SC2086
  [ -n "$ids" ] && docker rm -f $ids >/dev/null 2>&1 || true
fi

echo "Checking database connectivity..."
if ! docker compose --profile tools run --rm --no-deps --entrypoint sh migrate -c '
  set -e
  if ! pg_isready -d "$DATABASE_URL" -t 15 >/dev/null 2>&1; then
    echo "Cannot reach Postgres (pg_isready failed)." >&2
    echo "DATABASE_URL host must be reachable from the migrate container." >&2
    echo "For host Postgres, use localhost in .env — migrate runs with host networking." >&2
    pg_isready -d "$DATABASE_URL" -t 3 || true
    exit 1
  fi
  echo "Database is reachable."
'; then
  exit 1
fi

echo "Pushing database schema..."
if ! docker compose --profile tools run --rm --no-deps migrate; then
  echo "Database migration failed. See output above; check postgres logs and DATABASE_URL." >&2
  exit 1
fi

echo "Starting app on 127.0.0.1:3102..."
docker compose up -d --remove-orphans

echo "Done. Container status:"
docker compose ps
