#!/usr/bin/env bash
# Builds and pushes the API image, syncs secrets to Secret Manager, deploys to Cloud Run.
# Secrets live in Secret Manager; the rest are plain env vars. Values come only from deploy/.env.*.
. "$(dirname "$0")/lib.sh"
declare -A HOSTING APP
read_env "$DEPLOY_DIR/.env.hosting" HOSTING
read_env "$DEPLOY_DIR/.env.api" APP
require_keys HOSTING GCP_PROJECT_ID GCP_REGION CLOUD_RUN_SERVICE
require_keys APP DATABASE_URL JWT_SECRET CORS_ORIGIN

PROJECT="${HOSTING[GCP_PROJECT_ID]}"; REGION="${HOSTING[GCP_REGION]}"; SERVICE="${HOSTING[CLOUD_RUN_SERVICE]}"
SECRET_KEYS=(DATABASE_URL JWT_SECRET LOKI_API_KEY)
gcloud config set project "$PROJECT" --quiet >/dev/null
gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com --quiet
gcloud artifacts repositories describe exam --location "$REGION" >/dev/null 2>&1 \
  || gcloud artifacts repositories create exam --repository-format=docker --location "$REGION" --quiet
gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet >/dev/null 2>&1

IMAGE="$REGION-docker.pkg.dev/$PROJECT/exam/api:$(date +%Y%m%d%H%M%S)"
docker build --platform linux/amd64 -f "$REPO_ROOT/apps/api/Dockerfile" -t "$IMAGE" "$REPO_ROOT"
docker push "$IMAGE"

RUN_SA="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')-compute@developer.gserviceaccount.com"
SECRET_FLAGS=()
for key in "${SECRET_KEYS[@]}"; do
  [ -n "${APP[$key]:-}" ] || continue
  name="exam-$(echo "$key" | tr 'A-Z_' 'a-z-')"
  gcloud secrets describe "$name" >/dev/null 2>&1 || gcloud secrets create "$name" --replication-policy=automatic --quiet
  current="$(gcloud secrets versions access latest --secret "$name" 2>/dev/null || true)"
  [ "$current" = "${APP[$key]}" ] || printf '%s' "${APP[$key]}" | gcloud secrets versions add "$name" --data-file=- --quiet >/dev/null
  gcloud secrets add-iam-policy-binding "$name" --member "serviceAccount:$RUN_SA" \
    --role roles/secretmanager.secretAccessor --quiet >/dev/null
  SECRET_FLAGS+=("$key=$name:latest")
done

ENV_FILE="$(mktemp)"; chmod 600 "$ENV_FILE"; trap 'rm -f "$ENV_FILE"' EXIT
for key in "${!APP[@]}"; do
  case " ${SECRET_KEYS[*]} " in *" $key "*) continue ;; esac
  python3 -c 'import json,sys; print(sys.argv[1] + ": " + json.dumps(sys.argv[2]))' "$key" "${APP[$key]}" >> "$ENV_FILE"
done

gcloud run deploy "$SERVICE" --image "$IMAGE" --region "$REGION" --allow-unauthenticated \
  --min-instances 0 --max-instances 2 --memory 512Mi \
  --env-vars-file "$ENV_FILE" --set-secrets "$(IFS=,; echo "${SECRET_FLAGS[*]}")" --quiet
gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)'
