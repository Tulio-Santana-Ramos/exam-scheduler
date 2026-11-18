#!/usr/bin/env bash
# Writes deploy/.env.migrate and deploy/.env.api from Neon, without printing any secret.
# Needs `npx neonctl auth` done once. Refuses to overwrite existing files.
. "$(dirname "$0")/lib.sh"
declare -A HOSTING
read_env "$DEPLOY_DIR/.env.hosting" HOSTING
require_keys HOSTING NEON_PROJECT_ID NEON_BRANCH

for file in .env.migrate .env.api; do
  [ ! -e "$DEPLOY_DIR/$file" ] || { echo "deploy/$file already exists; delete it to regenerate" >&2; exit 1; }
done

neon_url() {
  npx --yes neonctl@latest connection-string "${HOSTING[NEON_BRANCH]}" --project-id "${HOSTING[NEON_PROJECT_ID]}" "$@"
}

umask 077
{ printf 'DATABASE_URL='; neon_url; } > "$DEPLOY_DIR/.env.migrate"
{
  printf 'DATABASE_URL='; neon_url --pooled
  printf 'JWT_SECRET=%s\n' "$(openssl rand -hex 32)"
  printf 'CORS_ORIGIN=http://localhost:5173\n'
  printf 'TRUST_PROXY=true\nDB_POOL_MAX=5\nRUN_MIGRATIONS=false\nRUN_SEED=false\nLOG_FORMAT=json\nLOG_LEVEL=info\n'
  printf '# LOKI_URL=\n# LOKI_USER=\n# LOKI_API_KEY=\n'
} > "$DEPLOY_DIR/.env.api"
echo "wrote deploy/.env.migrate and deploy/.env.api (keys only):"
cut -d= -f1 "$DEPLOY_DIR/.env.api" | grep -v '^#' | tr '\n' ' '; echo
