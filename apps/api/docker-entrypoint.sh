#!/bin/sh
set -e

# Migrations are idempotent and advisory-locked, so several replicas starting together are safe.
# Use a direct (non-pooled) DATABASE_URL when this is enabled against a hosted database.
if [ "$RUN_MIGRATIONS" = "true" ]; then
  node dist/scripts/migrate.js
fi

# Demo data only: never enable against a database holding real patients.
if [ "$RUN_SEED" = "true" ]; then
  node dist/scripts/seed.js
fi

exec "$@"
