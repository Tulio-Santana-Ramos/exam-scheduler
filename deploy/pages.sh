#!/usr/bin/env bash
# Builds the web app (VITE_API_URL comes from apps/web/.env.production.local) and uploads it to Cloudflare Pages.
. "$(dirname "$0")/lib.sh"
declare -A HOSTING
read_env "$DEPLOY_DIR/.env.hosting" HOSTING
require_keys HOSTING PAGES_PROJECT
[ -f "$REPO_ROOT/apps/web/.env.production.local" ] || { echo "missing apps/web/.env.production.local (VITE_API_URL)" >&2; exit 1; }

npm run build --workspace @exam-scheduler/web --prefix "$REPO_ROOT"
cd "$REPO_ROOT"
# --force: the default Pages path delegates to the Workers flow, which refuses monorepo roots.
if ! npx --yes wrangler@latest pages project list 2>/dev/null | grep -q "${HOSTING[PAGES_PROJECT]}"; then
  npx --yes wrangler@latest pages project create "${HOSTING[PAGES_PROJECT]}" --production-branch main --force
fi
npx --yes wrangler@latest pages deploy apps/web/dist --project-name "${HOSTING[PAGES_PROJECT]}" --branch main
