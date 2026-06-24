#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
elif [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set. Add it to .env.local or .env." >&2
  exit 1
fi

OUTPUT="wedding_seed.sql"

# Application tables only, in dependency order for restore.
TABLES=(
  users
  itinerary_days
  wedding_events
  itinerary_items
  public_schedule_items
  event_rsvp_settings
  guest_list_permissions
  guests
  guest_members
  task_permissions
  tasks
  task_notes
  task_reminders
  notifications
  sync_metadata
)

ARGS=()
for table in "${TABLES[@]}"; do
  ARGS+=(-t "$table")
done

run_pg_dump() {
  local pg_dump_bin="$1"
  "$pg_dump_bin" "$DATABASE_URL" \
    --data-only \
    --no-owner \
    --no-privileges \
    --column-inserts \
    "${ARGS[@]}" \
    --file "$OUTPUT"
}

resolve_pg_dump() {
  local candidate
  for candidate in \
    "${PG_DUMP:-}" \
    pg_dump \
    /opt/homebrew/opt/postgresql@17/bin/pg_dump \
    /opt/homebrew/opt/postgresql@16/bin/pg_dump \
    /usr/local/opt/postgresql@16/bin/pg_dump; do
    [[ -n "$candidate" ]] || continue
    if command -v "$candidate" >/dev/null 2>&1; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

if PG_DUMP_BIN="$(resolve_pg_dump)"; then
  if run_pg_dump "$PG_DUMP_BIN" 2>/tmp/wedding-pg-dump.err; then
    :
  elif grep -q "server version mismatch" /tmp/wedding-pg-dump.err 2>/dev/null; then
    echo "Local pg_dump version mismatch; using Docker postgres:16..." >&2
    PG_DUMP_BIN=""
  else
    cat /tmp/wedding-pg-dump.err >&2
    exit 1
  fi
fi

if [[ -z "${PG_DUMP_BIN:-}" ]]; then
  if ! command -v docker >/dev/null 2>&1; then
    echo "Need pg_dump 16+ or Docker. Install: brew install postgresql@16" >&2
    exit 1
  fi

  DUMP_URL="$DATABASE_URL"
  if [[ "$DUMP_URL" == *"@localhost"* ]]; then
    DUMP_URL="${DUMP_URL/@localhost/@host.docker.internal}"
  fi
  if [[ "$DUMP_URL" == *"127.0.0.1"* ]]; then
    DUMP_URL="${DUMP_URL/127.0.0.1/host.docker.internal}"
  fi

  docker run --rm \
    -e DUMP_URL="$DUMP_URL" \
    -v "$(pwd):/work" \
    -w /work \
    postgres:16-alpine \
    sh -c "pg_dump \"\$DUMP_URL\" --data-only --no-owner --no-privileges --column-inserts $(printf ' -t %s' "${TABLES[@]}") --file /work/$OUTPUT"
fi

# Ease restore when tasks.parent_task_id creates a circular FK.
tmp="$(mktemp)"
{
  echo "SET session_replication_role = replica;"
  cat "$OUTPUT"
  echo "SET session_replication_role = DEFAULT;"
} > "$tmp"
mv "$tmp" "$OUTPUT"

echo "Wrote $(pwd)/$OUTPUT ($(wc -l < "$OUTPUT" | tr -d ' ') lines)"
