#!/usr/bin/env bash
# Run ON the OpenELIS host (test or prod) to deploy a GHCR release tag.
# Usage:
#   GHCR_READ_USER=github_user GHCR_READ_TOKEN=ghp_xxx \
#     sudo -E bash scripts/deploy-release-on-server.sh v2026.06.18.05
#
# Hosts:
#   Test: 192.168.176.127  (/opt/OpenELIS-Docker)
#   Prod: 192.168.25.25     (/opt/OpenELIS-Docker)
set -euo pipefail

RELEASE="${1:?Release tag required, e.g. v2026.06.18.05}"
APP_DIR="${APP_DIR:-/opt/OpenELIS-Docker}"
WEBAPP_CONTAINER="${WEBAPP_CONTAINER:-openelisglobal-webapp}"

cd "${APP_DIR}"

if [[ -z "${GHCR_READ_USER:-}" || -z "${GHCR_READ_TOKEN:-}" ]]; then
  echo "ERROR: Set GHCR_READ_USER and GHCR_READ_TOKEN (PAT with read:packages)." >&2
  exit 1
fi

echo "Backing up docker-compose.yml..."
cp docker-compose.yml "docker-compose.yml.bak-${RELEASE}"

echo "Updating image tags to ${RELEASE}..."
sed -i 's#\(ghcr\.io/orbithealthplc/openelis-global-2[^:]*:\)v2026\.[^" ]*#\1'"${RELEASE}"'#g' docker-compose.yml

echo "--- image tags ---"
grep -E 'ghcr.io/orbithealthplc/openelis-global-2' docker-compose.yml || true

echo "Logging in to GHCR..."
echo "${GHCR_READ_TOKEN}" | docker login ghcr.io -u "${GHCR_READ_USER}" --password-stdin

echo "Pulling images..."
docker compose pull

echo "Starting containers..."
docker compose up -d

echo "--- container status ---"
docker compose ps

echo "Restarting webapp to pick up configuration..."
docker restart "${WEBAPP_CONTAINER}"

IMAGE="$(docker inspect "${WEBAPP_CONTAINER}" --format '{{.Config.Image}}')"
echo "Webapp image: ${IMAGE}"

if [[ "${IMAGE}" != *"${RELEASE}"* ]]; then
  echo "WARNING: webapp image does not contain ${RELEASE}; verify compose tags and pull output." >&2
  exit 1
fi

echo "Deploy complete: ${RELEASE}"
