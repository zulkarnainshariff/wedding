#!/bin/sh
set -e

mkdir -p /app/data/uploads /app/data/dumps
chown -R nextjs:nodejs /app/data/uploads /app/data/dumps /app/seeds 2>/dev/null || true

exec su-exec nextjs "$@"
