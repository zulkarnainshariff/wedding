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

echo "Pushing database schema..."
docker compose --profile tools run --rm migrate

echo "Starting app on 127.0.0.1:3102..."
docker compose up -d

echo "Done. Container status:"
docker compose ps
