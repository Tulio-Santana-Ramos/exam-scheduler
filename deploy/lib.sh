#!/usr/bin/env bash
# Shared helpers. Env files are parsed, never sourced: URLs contain & and = that a shell would mangle.
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$DEPLOY_DIR/.." && pwd)"
export PATH="$HOME/google-cloud-sdk/bin:$PATH"

# read_env <file> <assoc-array-name>
read_env() {
  local file="$1"
  local -n target="$2"
  [ -f "$file" ] || { echo "missing $file (see deploy/.env.example)" >&2; exit 1; }
  local key value
  while IFS='=' read -r key value || [ -n "$key" ]; do
    case "$key" in ''|'#'*) continue ;; esac
    target["$key"]="$value"
  done < "$file"
}

require_keys() {
  local -n source="$1"; shift
  local key
  for key in "$@"; do
    [ -n "${source[$key]:-}" ] || { echo "$key is empty in its env file" >&2; exit 1; }
  done
}
