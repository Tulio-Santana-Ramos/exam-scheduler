#!/usr/bin/env bash
# Runs migrations and the (idempotent) demo seed against Neon, using the same image that ships.
. "$(dirname "$0")/lib.sh"
declare -A MIGRATE
read_env "$DEPLOY_DIR/.env.migrate" MIGRATE
require_keys MIGRATE DATABASE_URL

IMAGE=exam-api:migrate
docker build --platform linux/amd64 -f "$REPO_ROOT/apps/api/Dockerfile" -t "$IMAGE" "$REPO_ROOT"
docker run --rm --env-file "$DEPLOY_DIR/.env.migrate" "$IMAGE" node dist/scripts/migrate.js
docker run --rm --env-file "$DEPLOY_DIR/.env.migrate" "$IMAGE" node dist/scripts/seed.js
